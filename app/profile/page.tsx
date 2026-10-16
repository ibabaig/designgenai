import { avatarUrl, requireCompleteProfile } from "@/lib/profiles";
import ProfileForm from "./profile-form";
import "../auth.css";

export default async function ProfilePage() {
  // Signed in AND has a name, otherwise this redirects for us.
  const { userId, profile } = await requireCompleteProfile();

  return (
    <main className="auth-page">
      <p className="auth-eyebrow">MEMBER PROFILE</p>
      <h1>Your profile.</h1>
      <p className="auth-copy">{profile.email}</p>

      <ProfileForm
        profile={profile}
        currentAvatarUrl={avatarUrl(profile.avatar_path)}
        userId={userId}
      />

      <form className="signout-form" action="/auth/signout" method="post">
        <button className="auth-back" type="submit">Sign out</button>
      </form>
    </main>
  );
}
