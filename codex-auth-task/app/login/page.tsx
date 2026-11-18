import GoogleButton from "./google-button";

// searchParams is a Promise in Next.js 15+. On 14 or earlier, drop the
// `await` and type it as a plain object.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main>
      <p>MUSEUM OF DIGITAL ARCHIVES</p>
      <h1>Sign in</h1>
      <p>Members can view the permanent collection and edit their profile.</p>
      <GoogleButton next={next} />
    </main>
  );
}
