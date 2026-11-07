"use client";

import { usePathname } from "next/navigation";

// THE ONE HEADER. Rendered by app/layout.tsx, so every route gets it
// without opting in — a page cannot forget it or render a different one.
//
// It reuses the landing page's own .site-header / .top-tabs /
// .header-center / .header-account classes. Signing in must not change
// what the chrome looks like: the same six tabs are present either way,
// and only the slot on the far right swaps.
//
// WHY THE ACCOUNT SLOT IS DELIBERATELY SHORT
// .site-header is a `1fr auto 1fr` grid. A wide third column grows past
// its share and steals width from the first, and .top-tabs is a flex
// row, so the tabs overflowed and clipped — leaving a signed-in visitor
// looking at "HELLO" and nothing else. Two guards now: the tabs wrap
// instead of clipping (galleries.css), and this slot stays narrow.
// Adding links here will reintroduce the bug; add them to ROOMS.
//
// Client component purely so usePathname() can mark the active room.
// It fetches nothing; the layout passes auth state down as props.

// The Registrar tab (the admin area) is appended to this same row for
// curators only, for exactly the reason the note above gives: a tab in
// .top-tabs wraps, a link in the account slot grows column 3 and eats
// the tabs. It is an external link to a different deployment, so it
// opens in a new tab and carries an explicit arrow.

const ROOMS = [
  { href: "/", label: "Hello" },
  { href: "/gallery", label: "Today" },
  { href: "/permanent", label: "Collection" },
  { href: "/archive", label: "Archive" },
  { href: "/cafe", label: "Café" },
  { href: "/collection", label: "Historical" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader({
  signedIn,
  canInteract,
  firstName,
  isSuperadmin = false,
  adminUrl,
}: {
  signedIn: boolean;
  canInteract: boolean;
  firstName?: string | null;
  isSuperadmin?: boolean;
  adminUrl?: string;
}) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="site-header">
      <nav className="top-tabs" aria-label="Main navigation">
        {ROOMS.map((r) => (
          <a
            key={r.href}
            href={r.href}
            className={isActive(pathname, r.href) ? "is-active" : undefined}
            aria-current={isActive(pathname, r.href) ? "page" : undefined}
          >
            {r.label}
          </a>
        ))}

        {isSuperadmin && adminUrl ? (
          <a
            className="is-admin"
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Registrar's Office — collection management, in a separate app"
          >
            Registrar &#8599;
          </a>
        ) : null}
      </nav>

      <a className="header-center" href="/" aria-label="Museum of Digital Art home">
        Museum of Digital Art
      </a>

      {canInteract ? (
        <div className="header-account header-account-member">
          <a href="/profile">{firstName || "Profile"}</a>
          <form action="/auth/signout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      ) : signedIn ? (
        <a className="header-account" href="/onboarding">
          Finish profile
        </a>
      ) : (
        <a className="header-account" href="/login">
          Member Sign In
        </a>
      )}
    </header>
  );
}
