import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WingRepository } from "@/lib/wings";
import { JokeRepository, accessionNumber } from "@/lib/jokes";
import { findSchool } from "@/lib/schools";
import "../museum.css";

// PUBLIC. No auth gate, and none needed: the RLS policy for `anon` is
// `using (accessioned_at is not null)`, so an anonymous request to the
// jokes table returns the permanent collection and literally nothing
// else. Today's open call, rejected work and every ballot stay private
// without a single line of filtering in this file.
//
// This page is the growth surface. Participation is members-only;
// reading the collection is open to anyone with the link.
export default async function PermanentCollectionPage() {
  const supabase = await createClient();

  const [wings, works] = await Promise.all([
    new WingRepository(supabase).findAll(),
    new JokeRepository(supabase).findAccessioned(100),
  ]);

  const wingName = new Map(wings.map((w) => [w.id, w]));

  // Group by wing so the archive reads as a museum floor rather than a
  // feed. Insertion order follows accession date, so recently active
  // galleries appear first.
  const byWing = new Map<number, typeof works>();
  for (const work of works) {
    const list = byWing.get(work.wing_id) ?? [];
    list.push(work);
    byWing.set(work.wing_id, list);
  }

  return (
    <main className="museum-page museum-permanent">
      <header className="museum-header permanent-header">
        <p>MUSEUM OF DIGITAL ART</p>
        <h1>The Permanent Collection</h1>
        <p>
          One work is acquired each day, chosen by the membership. Every piece
          here was written by an AI curator on commission and survived a vote.
        </p>
        <nav className="museum-nav">
          <Link href="/gallery">Today&apos;s hanging</Link>
          <Link href="/login">Become a member</Link>
        </nav>
      </header>

      {works.length === 0 ? (
        <section className="museum-empty">
          <h2>Acquisitions pending</h2>
          <p>
            The collection is empty. The first acquisition happens at the close
            of today&apos;s hanging.
          </p>
          <p>
            <Link href="/login">Sign in</Link> to commission a work before then.
          </p>
        </section>
      ) : (
        [...byWing.entries()].map(([wingId, group]) => {
          const wing = wingName.get(wingId);
          return (
            <section className="permanent-wing" key={wingId}>
              <div className="wing-heading"><h2>{wing?.name ?? "Uncatalogued"}</h2>
              <p>{wing?.era_label}</p>
              <p>{wing?.blurb}</p></div>

              <ul className="permanent-list">
                {group.map((work) => (
                  <li className="permanent-object" key={work.id}>
                    <blockquote className="permanent-joke">{work.body}</blockquote>
                    <p className="permanent-meta">
                      {findSchool(work.school)?.name} ·{" "}
                      {accessionNumber(work)}
                    </p>
                    <p className="credit-line">
                      Acquired{" "}
                      {work.accessioned_at
                        ? new Date(work.accessioned_at).toLocaleDateString(
                            "en-US",
                            { month: "long", day: "numeric", year: "numeric" }
                          )
                        : "—"}
                      . Gift of {work.credit_name ?? "an anonymous donor"}.
                    </p>
                    <p>
                      {work.score > 0 ? "+" : ""}
                      {work.score} at acquisition
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
