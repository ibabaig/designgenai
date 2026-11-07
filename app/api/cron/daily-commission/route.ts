import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWork } from "@/lib/gemini";
import { attachWork } from "@/lib/prompt-pipeline";
import { DEPARTMENTS, type DepartmentSlug } from "@/lib/departments";
import type { Wing } from "@/lib/wings";
import type { School } from "@/lib/works";

// THE MIDNIGHT JOB. Two things, in order:
//
//   1. Close yesterday — acquire each department's winner into the
//      permanent collection and write the exhibition record, including
//      for the departments where nothing happened.
//   2. Commission today — one house work per department, so every
//      gallery has something in it from the moment it opens and a
//      visitor who arrives at 9am is not looking at four bare walls.
//
// The house work is the baseline the membership votes against. Members
// then add up to three of their own across the whole museum.
//
// Runs as service_role, which bypasses RLS: these rows have no author,
// so no member session could create them.

export const dynamic = "force-dynamic";
export const maxDuration = 300; // generation is four model calls

// Vercel sets this header on its own cron invocations. Without the
// check, anyone who found the URL could burn the model budget.
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const db = createAdminClient();
  const log: Record<string, unknown> = {};

  // ---- 1. close yesterday ------------------------------------
  try {
    const { data, error } = await db.rpc("close_gallery");
    if (error) throw new Error(error.message);
    log.closed = data;
  } catch (e) {
    log.closeError = e instanceof Error ? e.message : String(e);
  }

  // ---- 2. today's wing ---------------------------------------
  const { data: wingId, error: wingErr } = await db.rpc("current_wing_id");
  if (wingErr || !wingId) {
    return NextResponse.json(
      { ...log, error: `no wing: ${wingErr?.message ?? "none returned"}` },
      { status: 500 }
    );
  }

  const { data: wing } = await db
    .from("wings")
    .select("id, slug, name, era_label, blurb, subject, sort_order")
    .eq("id", wingId)
    .single();

  if (!wing) {
    return NextResponse.json({ ...log, error: "wing not found" }, { status: 500 });
  }

  const { data: allSchools } = await db
    .from("schools")
    .select("slug, department, name, blurb, sort_order")
    .order("sort_order");

  const today = new Date().toISOString().slice(0, 10);

  // Idempotent: if the job is retried, or fires twice, it must not hang
  // a second house work in a department that already has one.
  const { data: existing } = await db
    .from("works")
    .select("department")
    .eq("hung_on", today)
    .eq("origin", "house");

  const alreadyHung = new Set((existing ?? []).map((w) => w.department));

  // ---- 3. commission one work per department ------------------
  const results: Record<string, string> = {};

  for (const dept of DEPARTMENTS) {
    if (alreadyHung.has(dept.slug)) {
      results[dept.slug] = "already hung today";
      continue;
    }

    const pool = (allSchools ?? []).filter(
      (s) => s.department === dept.slug
    ) as School[];

    if (pool.length === 0) {
      results[dept.slug] = "no schools configured";
      continue;
    }

    // A different school each day, so the house does not develop a
    // house style. Keyed to the date so a retry picks the same one.
    const dayIndex = Math.floor(Date.parse(today) / 86_400_000);
    const school = pool[dayIndex % pool.length];

    try {
      // Runs as service_role, which bypasses RLS entirely -- so this is
      // the one caller that can write origin 'house'.
      const gen = await generateWork(
        wing as Wing,
        school,
        dept.slug as DepartmentSlug,
        { db, requesterId: null, origin: "house" }
      );

      const { data: inserted, error } = await db.from("works").insert({
        wing_id: wing.id,
        author_id: null,
        origin: "house",
        department: dept.slug,
        school: school.slug,
        prompt: gen.prompt,
        model: gen.model,
        title: gen.title ?? null,
        body: gen.body ?? null,
        svg_source: gen.svgSource ?? null,
        caption: gen.caption ?? null,
        hung_on: today,
      }).select("id").single();

      if (!error && inserted) {
        await attachWork(db, gen.requestId ?? null, (inserted as { id: number }).id);
      }

      results[dept.slug] = error ? `insert failed: ${error.message}` : `hung (${school.slug})`;
    } catch (e) {
      // One department failing must not stop the other three.
      results[dept.slug] = `generation failed: ${e instanceof Error ? e.message : e}`;
    }
  }

  return NextResponse.json({ ...log, wing: wing.name, commissioned: results });
}
