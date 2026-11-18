"use server";

import { revalidatePath } from "next/cache";
import { requireCompleteProfile } from "@/lib/profiles";
import { WorkRepository, VoteRepository } from "@/lib/works";
import { commission } from "@/lib/commission";
import { isDepartmentSlug } from "@/lib/departments";
import { BODY_LIMITS, countChars, isEditableDepartment } from "@/lib/work-limits";

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
    await commission(supabase, userId, department, schoolSlug);
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

// The member rewords their own joke or poem. Checked three times: here
// (length, so the message is friendly), by RLS (own, today, text, not
// acquired) and by the guard trigger (body only, and the same cap).
export async function rewordWork(
  workId: number,
  department: string,
  body: string
): Promise<ActionResult & { body?: string }> {
  if (!isEditableDepartment(department)) {
    return { ok: false, message: "Only humour and poetry can be reworded." };
  }
  const text = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return { ok: false, message: "A work cannot be blank." };
  const limit = BODY_LIMITS[department];
  if (countChars(text) > limit) {
    return { ok: false, message: `That is ${countChars(text)} characters; the limit is ${limit}.` };
  }

  try {
    const { supabase } = await requireCompleteProfile();
    const work = await new WorkRepository(supabase).reword(workId, text);
    revalidatePath(`/gallery/${department}`);
    revalidatePath("/gallery");
    return { ok: true, message: "Reworded.", body: work.body ?? text };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save." };
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
