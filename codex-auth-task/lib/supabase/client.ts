import { createBrowserClient } from "@supabase/ssr";

// Supabase client for code that runs in the browser (Client Components).
// Used for the Google sign-in button and for uploading the avatar file.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
