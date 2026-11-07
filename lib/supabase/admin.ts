import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVICE-ROLE CLIENT. Read this before using it.
//
// This key bypasses Row Level Security completely. It is the one
// credential in the project that can read and write anything, so:
//
//   - It is SERVER-ONLY. No NEXT_PUBLIC_ prefix, and this module must
//     never be imported by a file carrying "use client". Doing so
//     would ship the key to every visitor's browser.
//   - It is used in exactly one place: the midnight cron route, which
//     inserts the museum's own daily commissions. Those rows have no
//     author, so no member session could create them and no RLS policy
//     should be loosened to allow it.
//   - Nothing a visitor can reach should ever call this. If you find
//     yourself wanting it in a page or a server action, the answer is
//     almost always a policy change instead.
//
// No cookie handling and no session: this client is nobody.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local and to " +
        "Vercel's Environment Variables. It must NOT have a NEXT_PUBLIC_ prefix."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
