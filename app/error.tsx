"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{ padding: "4rem", fontFamily: "Space Mono, monospace" }}><p>Something went wrong.</p><button type="button" onClick={() => reset()}>Try again</button></main>;
}
