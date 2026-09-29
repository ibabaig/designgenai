import Link from "next/link";

export default function AuthCodeError() {
  return (
    <main>
      <h1>Sign-in didn&apos;t finish</h1>
      <p>
        The code from Google couldn&apos;t be exchanged for a session. This
        usually means the redirect URL isn&apos;t on Supabase&apos;s allow list,
        or the link was already used.
      </p>
      <Link href="/login">Try again</Link>
    </main>
  );
}
