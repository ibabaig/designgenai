import GoogleButton from "./google-button";
import "../auth.css";

// searchParams is a Promise in Next.js 15+. On 14 or earlier, drop the
// `await` and type it as a plain object.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="auth-page">
      <a className="auth-wordmark" href="/">M<span>_</span>DA</a>
      <p className="auth-eyebrow">MUSEUM OF DIGITAL ART / MEMBERS</p>
      <h1>Sign in.</h1>
      <p className="auth-copy">Enter the permanent collection and keep your visitor profile up to date.</p>
      <GoogleButton next={next} />
      <a className="auth-back" href="/">← Back to the exhibition</a>
    </main>
  );
}
