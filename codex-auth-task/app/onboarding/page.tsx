import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProfileRepository, requireUser } from "@/lib/profiles";

// Shown right after a first-time sign-in, because the trigger created the
// profile row with NULL names. Once both are filled in, the user is never
// sent here again.
export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const profile = await new ProfileRepository(supabase).findById(userId);

  if (profile?.first_name?.trim() && profile?.last_name?.trim()) {
    redirect("/collection");
  }

  // Server Action: runs on the server when the form is submitted.
  async function save(formData: FormData) {
    "use server";

    const { supabase, userId } = await requireUser();
    const first = String(formData.get("first_name") ?? "").trim();
    const last = String(formData.get("last_name") ?? "").trim();

    if (!first || !last) return; // the `required` attributes catch this first

    await new ProfileRepository(supabase).update(userId, {
      first_name: first,
      last_name: last,
    });

    revalidatePath("/", "layout");
    redirect("/collection");
  }

  return (
    <main>
      <h1>One more thing</h1>
      <p>Tell us your name so we know who&apos;s visiting.</p>

      <form action={save}>
        <label htmlFor="first_name">First name</label>
        <input id="first_name" name="first_name" required />

        <label htmlFor="last_name">Last name</label>
        <input id="last_name" name="last_name" required />

        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
