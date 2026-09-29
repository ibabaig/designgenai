import { avatarUrl, requireCompleteProfile } from "@/lib/profiles";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  // Signed in AND has a name, otherwise this redirects for us.
  const { userId, profile } = await requireCompleteProfile();

  return (
    <main>
      <h1>Profile</h1>
      <p>{profile.email}</p>

      <ProfileForm
        profile={profile}
        currentAvatarUrl={avatarUrl(profile.avatar_path)}
        userId={userId}
      />

      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
