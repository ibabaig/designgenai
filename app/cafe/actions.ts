"use server";

import { revalidatePath } from "next/cache";
import { requireCompleteProfile } from "@/lib/profiles";
import { DrinkRepository, SeatRepository, NOTE_LIMIT } from "@/lib/cafe";

export type ActionResult = { ok: boolean; message: string };

// The display name is snapshotted onto the seat row here rather than
// joined from profiles at read time. Same pattern as credit_name on an
// acquired work: it is what lets profiles stay locked to own-row-only
// while nametags still appear on the tables.
export async function takeSeat(
  drinkSlug: string,
  rawNote: string
): Promise<ActionResult> {
  try {
    const { supabase, userId, profile } = await requireCompleteProfile();

    const drinks = await new DrinkRepository(supabase).findAll();
    if (!drinks.some((d) => d.slug === drinkSlug)) {
      return { ok: false, message: "That isn't on the menu." };
    }

    const note = rawNote.trim();
    if (note.length > NOTE_LIMIT) {
      return {
        ok: false,
        message: `Notes are limited to ${NOTE_LIMIT} characters.`,
      };
    }

    const displayName =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
      "A member";

    await new SeatRepository(supabase).sit({
      patronId: userId,
      displayName,
      drinkSlug,
      note: note.length > 0 ? note : null,
    });

    revalidatePath("/cafe");
    return { ok: true, message: "Order up." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "The café is closed.",
    };
  }
}

export async function leaveCafe(): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireCompleteProfile();
    await new SeatRepository(supabase).leave(userId);

    revalidatePath("/cafe");
    return { ok: true, message: "Table cleared." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not clear your table.",
    };
  }
}
