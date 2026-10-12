import Link from "next/link";
import { getArtworks } from "@/lib/artworks";
import { avatarUrl, requireCompleteProfile } from "@/lib/profiles";
import "../artworks/artworks.css";

// THE GATED ROUTE. Two layers guard it:
//   1. middleware.ts bounces anonymous visitors to /login before this runs
//   2. requireCompleteProfile() re-checks on the server, so the page is
//      safe even if the matcher is ever misconfigured
export default async function CollectionPage() {
  const { profile } = await requireCompleteProfile();
  const artworks = await getArtworks();
  const photo = avatarUrl(profile.avatar_path);

  return (
    <main className="artworks-page">
      <header className="artworks-header">
        <a href="/" className="artworks-wordmark" aria-label="MDA home">M<span>_</span>DA</a>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={40} height={40} />
        )}
        <p className="collection-welcome">Welcome back, {profile.first_name} {profile.last_name}. <Link href="/profile">Profile</Link></p>
        <form action="/auth/signout" method="post"><button className="collection-signout" type="submit">Sign out</button></form>
      </header>

      <section className="artworks-collection" aria-labelledby="artworks-title">
      <p className="artworks-eyebrow">MEMBER COLLECTION</p>
      <h1 id="artworks-title">THE COLLECTION.</h1>
      <p>{artworks.length} works, members only.</p>
      <nav className="collection-feature-links" aria-label="Joke museum">
        <Link href="/gallery">Enter today&apos;s joke gallery</Link>
        <Link href="/permanent">Browse the permanent collection</Link>
      </nav>

      <div className="artworks-grid">
        {artworks.map((art, i) => (
          <article className="artwork-card" key={art.id}>
            <p className="artwork-number">
              WORK {String(i + 1).padStart(2, "0")} / {artworks.length}
            </p>
            <h2>{art.title}</h2>
            <dl><div><dt>Artist</dt><dd>{art.artist}</dd></div><div><dt>Date</dt><dd>{art.date_display}</dd></div><div><dt>Medium</dt><dd>{art.medium}</dd></div></dl>
          </article>
        ))}
      </div>
      </section>
    </main>
  );
}
