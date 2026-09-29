"use server";

import { revalidatePath } from "next/cache";
import { ProfileRepository, requireUser } from "@/lib/profiles";

export type SaveResult = { ok: boolean; message: string };

// Server Action called by the profile form. It only ever writes TEXT:
// avatarPath is a string like "<user-id>/1730000000.jpg". The image bytes
// themselves live in Supabase Storage, never in Postgres.
export async function saveProfile(
  firstName: string,
  lastName: string,
  avatarPath: string | null
): Promise<SaveResult> {
  const first = firstName.trim();
  const last = lastName.trim();

  if (!first || !last) {
    return { ok: false, message: "First and last name are both required." };
  }

  try {
    const { supabase, userId } = await requireUser();

    await new ProfileRepository(supabase).update(userId, {
      first_name: first,
      last_name: last,
      ...(avatarPath ? { avatar_path: avatarPath } : {}),
    });

    revalidatePath("/profile");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
