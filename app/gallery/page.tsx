import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import { WorkRepository } from "@/lib/works";
import { DEPARTMENTS } from "@/lib/departments";
import DepartmentNav from "./department-nav";
import "../museum.css";
import "../galleries.css";

// Public reading surface, same pattern as before: anyone can walk the
// museum, only members can make or judge work. The anon RLS policy on
// works allows today's hanging and the permanent collection, so a
// logged-out visitor sees a real gallery rather than an empty room.
export default async function GalleryLobby() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;
  const canInteract = Boolean(userId && isComplete(profile));

  const wing = await new WingRepository(supabase).findCurrent();
  const counts = await new WorkRepository(supabase).countsToday();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="museum-page museum-gallery">
      <header className="museum-header">
        <p>MUSEUM OF DIGITAL ART · TODAY&apos;S HANGING</p>
        <h1>{wing.name}</h1>
        <p>{wing.era_label}</p>
        <p>{wing.blurb}</p>
        <p className="wing-subject">
          Today every department is working on: {wing.subject}
        </p>
        <p>
          The museum closes at midnight. Each department acquires one work —
          four acquisitions a day, chosen by the membership. Ballots are
          private, and nothing shows who made what until a work is acquired.
        </p>
        <nav className="museum-nav">
          <Link href="/permanent">The permanent collection</Link>
          <Link href="/archive">Exhibition history</Link>
          <Link href="/cafe">The café</Link>
          <Link href="/collection">Historical collection</Link>
          {canInteract ? (
            <Link href="/profile">Profile</Link>
          ) : (
            <Link href={userId ? "/onboarding" : "/login?next=/gallery"}>
              {userId ? "Complete your profile" : "Member sign in to participate"}
            </Link>
          )}
        </nav>
      </header>

      <DepartmentNav counts={counts} />

      <section className="department-index">
        <p className="museum-kicker">
          {total === 0
            ? "NOTHING HUNG ANYWHERE YET TODAY"
            : `${total} ${total === 1 ? "WORK" : "WORKS"} ON VIEW ACROSS THE MUSEUM`}
        </p>
        <ul className="department-cards">
          {DEPARTMENTS.map((d) => (
            <li key={d.slug} className={`department-card dept-${d.slug}`}>
              <Link href={`/gallery/${d.slug}`}>
                <p className="label-number">
                  {String(d.order).padStart(2, "0")} / {DEPARTMENTS.length}
                </p>
                <h2>{d.shortName}</h2>
                <p className="department-blurb">{d.blurb}</p>
                <p className="department-count">
                  {(counts[d.slug] ?? 0) === 0
                    ? "Empty — be the first"
                    : `${counts[d.slug]} on view`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
