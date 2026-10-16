import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require a signed-in user. Everything else stays public,
// so your Manus landing page still works for visitors.
// Pages are visible to everyone; only ACTIONS are gated, at the server
// action and again by RLS. The only routes that truly need a session
// are the ones that are about your own account.
const PROTECTED = ["/profile", "/onboarding"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Create a new client on every request. Never hoist this into a
  // module-level variable: on serverless it would leak between users.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do NOT put code between createServerClient and getClaims(). Anything
  // in between makes "randomly logged out" bugs very hard to track down.
  // getClaims() both refreshes the token and verifies its signature.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path); // send them back here after login
    return NextResponse.redirect(url);
  }

  // Return supabaseResponse as-is. If you build a different response,
  // copy its cookies over first or the browser and server fall out of
  // sync and the session dies early.
  return supabaseResponse;
}
