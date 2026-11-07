"use server";

import { revalidatePath } from "next/cache";
import { requireCompleteProfile } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import { SchoolRepository, WorkRepository, VoteRepository } from "@/lib/works";
import { generateWork } from "@/lib/gemini";
import { attachWork } from "@/lib/prompt-pipeline";
import { isDepartmentSlug } from "@/lib/departments";

export type ActionResult = { ok: boolean; message: string };

// Pages read publicly; every mutation goes through here, and every one
// opens with requireCompleteProfile(), which calls getClaims() and
// redirects without a verified session. That is gate one. RLS is gate two
// and independent: a forged request straight to the REST API still cannot
// submit as another member, submit to a closed wing, exceed the
// per-department daily cap, pair a school with the wrong department, or
// vote on its own work.

export async function commissionWork(
  department: string,
  schoolSlug: string
): Promise<ActionResult> {
  if (!isDepartmentSlug(department)) {
    return { ok: false, message: "No such department." };
  }

  try {
    const { supabase, userId } = await requireCompleteProfile();

    const school = await new SchoolRepository(supabase).findOne(schoolSlug, department);
    if (!school) {
      return { ok: false, message: "That school doesn't work in this department." };
    }

    // The wing is read server-side, never accepted from the client. The
    // RLS policy checks it against current_wing_id() regardless.
    const wing = await new WingRepository(supabase).findCurrent();

    // Call the model first: if it fails, nothing is written and the
    // attempt does not count against the member's three.
    //
    // The context switches generation over to the prompt chains in the
    // database and makes the attempt leave a generation_requests row
    // either way -- which is the only reason a failure rate exists to
    // be measured. It runs as the member, so the RLS insert policy on
    // generation_requests is what stops a forged house attempt.
    const gen = await generateWork(wing, school, department, {
      db: supabase,
      requesterId: userId,
      origin: "member",
    });

    const work = await new WorkRepository(supabase).create({
      wingId: wing.id,
      authorId: userId,
      department,
      school: school.slug,
      prompt: gen.prompt,
      model: gen.model,
      title: gen.title,
      body: gen.body,
      svgSource: gen.svgSource,
      caption: gen.caption,
    });

    // The work id only exists after the insert, so the link back to the
    // attempt is made here. Best-effort: a missing link is a gap in the
    // telemetry, not a failed commission.
    await attachWork(supabase, gen.requestId ?? null, work.id);

    revalidatePath(`/gallery/${department}`);
    revalidatePath("/gallery");
    return { ok: true, message: "Hung on the wall." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "The curator is unavailable.",
    };
  }
}

export async function castVote(
  workId: number,
  value: -1 | 1,
  department: string
): Promise<ActionResult> {
  if (value !== -1 && value !== 1) {
    return { ok: false, message: "A vote is either up or down." };
  }
  try {
    const { supabase, userId } = await requireCompleteProfile();
    await new VoteRepository(supabase).cast(workId, userId, value);
    revalidatePath(`/gallery/${department}`);
    return { ok: true, message: "Vote recorded." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Vote failed." };
  }
}

export async function retractVote(
  workId: number,
  department: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireCompleteProfile();
    await new VoteRepository(supabase).retract(workId);
    revalidatePath(`/gallery/${department}`);
    return { ok: true, message: "Vote withdrawn." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not withdraw vote.",
    };
  }
}

export async function withdrawWork(
  workId: number,
  department: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireCompleteProfile();
    await new WorkRepository(supabase).withdraw(workId);
    revalidatePath(`/gallery/${department}`);
    return { ok: true, message: "Withdrawn." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not withdraw." };
  }
}
