import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import SiteHeader from "./site-header";
import "./globals.css";
// gallery.css carries .site-header and its responsive rules. It is
// imported here rather than per-page so the header is styled on every
// route, including the auth pages.
import "./gallery.css";

export const metadata: Metadata = {
  title: "HELLO, WORLD. — Gallery",
  description: "HELLO, WORLD. A typographic exhibition at the Museum of Digital Art.",
};

// Async so the header can be rendered with real auth state on the
// server. Doing it here, once, is what guarantees every page carries
// the same bar — a page has no way to opt out or render a different one.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;

  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;

  return (
    <html lang="en">
      <body>
        <SiteHeader
          signedIn={Boolean(userId)}
          canInteract={Boolean(userId && isComplete(profile))}
          firstName={profile?.first_name}
        />
        {children}
      </body>
    </html>
  );
}
