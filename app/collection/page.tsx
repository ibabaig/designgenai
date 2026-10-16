import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getArtworks } from "@/lib/artworks";
import { ProfileRepository, isComplete, avatarUrl } from "@/lib/profiles";
import "../artworks/artworks.css";
import "../galleries.css";

// PUBLIC, same as every other room in the museum. This is the MoMA
// catalogue — reference material with nothing to protect, and the
// artworks table already grants select to anon. It used to sit behind
// requireCompleteProfile(), which meant the Historical tab in the header
// bounced signed-out visitors to the login screen; the rule now is that
// every page is visible to everyone and only the actions are gated.
export default async function CollectionPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;
  const canInteract = Boolean(userId && isComplete(profile));
  const photo = canInteract ? avatarUrl(profile!.avatar_path) : null;

  const artworks = await getArtworks();

  return (
    <main className="artworks-page">
      {canInteract && (
        <header className="artworks-header">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={40} height={40} />
          )}
          <p className="collection-welcome">
            Welcome back, {profile!.first_name} {profile!.last_name}.
          </p>
        </header>
      )}

      <section className="artworks-collection" aria-labelledby="artworks-title">
        <p className="artworks-eyebrow">THE HISTORICAL COLLECTION</p>
        <h1 id="artworks-title">THE COLLECTION.</h1>
        <p>{artworks.length} works on permanent display.</p>
        <nav className="collection-feature-links" aria-label="Elsewhere in the museum">
          <Link href="/gallery">Enter today&apos;s hanging</Link>
          <Link href="/permanent">Browse the permanent collection</Link>
        </nav>

        <div className="artworks-grid">
          {artworks.map((art, i) => (
            <article className="artwork-card" key={art.id}>
              <p className="artwork-number">
                WORK {String(i + 1).padStart(2, "0")} / {artworks.length}
              </p>
              <h2>{art.title}</h2>
              <dl>
                <div><dt>Artist</dt><dd>{art.artist}</dd></div>
                <div><dt>Date</dt><dd>{art.date_display}</dd></div>
                <div><dt>Medium</dt><dd>{art.medium}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
