"use client";

export default function ArtworksError({ reset }: { reset: () => void }) {
  return <main className="artworks-error"><p>THE COLLECTION IS UNAVAILABLE</p><h1>We couldn’t load the artworks.</h1><button type="button" onClick={() => reset()}>Try again</button></main>;
}
