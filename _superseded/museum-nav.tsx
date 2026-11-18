import Link from "next/link";

// ONE navigation for the whole museum.
//
// The bug this fixes: signing in used to land you on /collection, whose
// header carried only two links, so every new room (departments,
// archive, café) vanished the moment you authenticated. Navigation
// should never depend on which page you happen to be standing in.
//
// Rendered by every museum page. Takes its auth state as props rather
// than querying, so a page that already knows who the visitor is does
// not pay for a second round trip.

export type NavKey =
  | "gallery"
  | "permanent"
  | "archive"
  | "cafe"
  | "collection";

const ROOMS: { key: NavKey; href: string; label: string; membersOnly?: boolean }[] = [
  { key: "gallery", href: "/gallery", label: "Today" },
  { key: "permanent", href: "/permanent", label: "Collection" },
  { key: "archive", href: "/archive", label: "Archive" },
  { key: "cafe", href: "/cafe", label: "Café", membersOnly: true },
  { key: "collection", href: "/collection", label: "Historical", membersOnly: true },
];

export default function MuseumNav({
  active,
  signedIn,
  canInteract,
  firstName,
}: {
  active?: NavKey;
  signedIn: boolean;
  canInteract: boolean;
  firstName?: string | null;
}) {
  return (
    <nav className="museum-bar" aria-label="Museum navigation">
      <Link className="museum-bar-mark" href="/" aria-label="Museum of Digital Archives home">
        M<span>_</span>DA
      </Link>

      <ul className="museum-bar-rooms">
        {ROOMS.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className={active === r.key ? "is-active" : undefined}
              aria-current={active === r.key ? "page" : undefined}
            >
              {r.label}
              {r.membersOnly && !canInteract && (
                <span className="members-dot" aria-label="members only" title="Members only">
                  ·
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <div className="museum-bar-account">
        {canInteract ? (
          <>
            <Link href="/profile">{firstName ? firstName : "Profile"}</Link>
            <form action="/auth/signout" method="post">
              <button type="submit">Sign out</button>
            </form>
          </>
        ) : signedIn ? (
          <Link href="/onboarding">Finish your profile</Link>
        ) : (
          <Link href="/login?next=/gallery">Member sign in</Link>
        )}
      </div>
    </nav>
  );
}
