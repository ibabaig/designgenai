import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Builds a Supabase client for Server Components, Server Actions, and Route Handlers.
// The URL and key come from environment variables; nothing is hardcoded.
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env.local (local) and to Vercel's Environment Variables (deployed)."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components can't write cookies. Safe to ignore until you add auth.
        }
      },
    },
  });
}
