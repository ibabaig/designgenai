import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// MODEL: one row of public.profiles
export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

// Same repository pattern as the artworks table in assignment 2:
// the only place in the app that knows profile column names.
export class ProfileRepository {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async findById(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from("profiles")
      .select("id, email, first_name, last_name, avatar_path")
      .eq("id", userId)
      .maybeSingle(); // null instead of throwing when there's no row

    if (error) throw new Error(`Could not load profile: ${error.message}`);
    return data as Profile | null;
  }

  async update(
    userId: string,
    fields: Partial<Pick<Profile, "first_name" | "last_name" | "avatar_path">>
  ): Promise<void> {
    const { error } = await this.db
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw new Error(`Could not save profile: ${error.message}`);
  }
}

// A profile counts as complete once both names are filled in.
export function isComplete(profile: Profile | null): boolean {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

// Gate for pages that need a signed-in user.
// getClaims() verifies the JWT signature; getSession() does not, so never
// use getSession() to decide whether someone is allowed to see a page.
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) redirect("/login");

  return { supabase, userId: claims.sub as string };
}

// Gate for pages that need a signed-in user WITH a finished profile.
// This is what sends first-time users to the "tell us your name" screen.
export async function requireCompleteProfile() {
  const { supabase, userId } = await requireUser();
  const profile = await new ProfileRepository(supabase).findById(userId);

  if (!isComplete(profile)) redirect("/onboarding");

  return { supabase, userId, profile: profile as Profile };
}

// Public URL for an avatar. The bucket is public, so no signing needed.
export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
