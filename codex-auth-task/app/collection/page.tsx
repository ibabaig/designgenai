import Link from "next/link";
import { getArtworks } from "@/lib/artworks";
import { avatarUrl, requireCompleteProfile } from "@/lib/profiles";

// THE GATED ROUTE. Two layers guard it:
//   1. middleware.ts bounces anonymous visitors to /login before this runs
//   2. requireCompleteProfile() re-checks on the server, so the page is
//      safe even if the matcher is ever misconfigured
export default async function CollectionPage() {
  const { profile } = await requireCompleteProfile();
  const artworks = await getArtworks();
  const photo = avatarUrl(profile.avatar_path);

  return (
    <main>
      <header>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={40} height={40} />
        )}
        <p>
          Welcome back, {profile.first_name} {profile.last_name}.{" "}
          <Link href="/profile">Profile</Link>
        </p>
      </header>

      <h1>The Permanent Collection</h1>
      <p>{artworks.length} works, members only.</p>

      <ul>
        {artworks.map((art, i) => (
          <li key={art.id}>
            <span>
              WORK {String(i + 1).padStart(2, "0")} / {artworks.length}
            </span>
            <h2>{art.title}</h2>
            <p>{art.artist}</p>
            <p>{art.date_display}</p>
            <p>{art.medium}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
