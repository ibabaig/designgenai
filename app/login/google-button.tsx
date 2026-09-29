"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // redirectTo MUST point at /auth/callback with no extra query params
    // beyond `next`. window.location.origin makes this work on localhost
    // and on Vercel without changing the code.
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates to Google; nothing else to do here.
  }

  return (
    <div className="google-auth">
      <button className="auth-button" onClick={signIn} disabled={loading}>
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
