import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here with a ?code=... query param.
// We trade that code for a session and store it in cookies.
// The assignment requires this exact path: /auth/callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Where to send them once signed in. Default to the gated page.
  let next = searchParams.get("next") ?? "/collection";
  if (!next.startsWith("/")) next = "/collection"; // block open redirects

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // On Vercel the request passes through a load balancer, so the
      // original host is in x-forwarded-host, not in `origin`.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      if (isLocal) return NextResponse.redirect(`${origin}${next}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
