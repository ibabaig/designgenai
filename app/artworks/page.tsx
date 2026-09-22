import { getArtworks } from "@/lib/artworks";
import "./artworks.css";

export default async function ArtworksPage() {
  const artworks = await getArtworks();

  return (
    <main className="artworks-page">
      <header className="artworks-header">
        <a href="/" className="artworks-wordmark" aria-label="MDA home">M<span>_</span>DA</a>
        <p>THE PERMANENT COLLECTION</p>
      </header>
      <section className="artworks-collection" aria-labelledby="artworks-title">
        <p className="artworks-eyebrow">SUPABASE COLLECTION</p>
        <h1 id="artworks-title">ARTWORKS.</h1>
        {artworks.length === 0 ? (
          <p className="artworks-empty">No artworks are available yet. If you expected to see artworks here, check the Supabase table permissions and row-level security policy.</p>
        ) : (
          <div className="artworks-grid">
            {artworks.map((artwork, index) => (
              <article className="artwork-card" key={artwork.id}>
                <p className="artwork-number">WORK {String(index + 1).padStart(2, "0")} / {String(artworks.length).padStart(2, "0")}</p>
                <h2>{artwork.title}</h2>
                <dl>
                  <div><dt>Artist</dt><dd>{artwork.artist}{artwork.artist_nationality && `, ${artwork.artist_nationality}`}</dd></div>
                  <div><dt>Date</dt><dd>{artwork.date_display || artwork.year}</dd></div>
                  <div><dt>Medium</dt><dd>{artwork.medium}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
