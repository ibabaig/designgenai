"use server";

import { revalidatePath } from "next/cache";
import { requireCompleteProfile } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import { JokeRepository, VoteRepository } from "@/lib/jokes";
import { generateJoke } from "@/lib/gemini";
import { isSchoolSlug } from "@/lib/schools";

export type ActionResult = { ok: boolean; message: string };

// Every action opens with requireCompleteProfile(), which calls
// getClaims() and redirects when there is no verified session. That is
// gate one. RLS is gate two, and it is independent: a forged request
// straight to the REST API still cannot submit as another member,
// submit to a closed wing, exceed the daily cap, or vote on its own work.

export async function commissionJoke(school: string): Promise<ActionResult> {
  if (!isSchoolSlug(school)) {
    return { ok: false, message: "Unknown school." };
  }

  try {
    const { supabase, userId } = await requireCompleteProfile();

    // The wing is read from the server, never passed in from the
    // client. The RLS policy checks wing_id against current_wing_id()
    // anyway, so a tampered value would be rejected -- but there is no
    // reason to accept it in the first place.
    const wing = await new WingRepository(supabase).findCurrent();

    // Call the model first: if it fails, nothing has been written and
    // the attempt does not count against the member's three.
    const { body, model, prompt } = await generateJoke(wing, school);

    await new JokeRepository(supabase).create({
      wingId: wing.id,
      authorId: userId,
      school,
      prompt,
      model,
      body,
    });

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
  jokeId: number,
  value: -1 | 1
): Promise<ActionResult> {
  if (value !== -1 && value !== 1) {
    return { ok: false, message: "A vote is either up or down." };
  }

  try {
    const { supabase, userId } = await requireCompleteProfile();
    await new VoteRepository(supabase).cast(jokeId, userId, value);

    revalidatePath("/gallery");
    return { ok: true, message: "Vote recorded." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Vote failed." };
  }
}

export async function retractVote(jokeId: number): Promise<ActionResult> {
  try {
    const { supabase } = await requireCompleteProfile();
    await new VoteRepository(supabase).retract(jokeId);

    revalidatePath("/gallery");
    return { ok: true, message: "Vote withdrawn." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not withdraw vote.",
    };
  }
}

export async function withdrawJoke(jokeId: number): Promise<ActionResult> {
  try {
    const { supabase } = await requireCompleteProfile();
    await new JokeRepository(supabase).withdraw(jokeId);

    revalidatePath("/gallery");
    return { ok: true, message: "Withdrawn." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not withdraw.",
    };
  }
}
