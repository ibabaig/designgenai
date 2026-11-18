import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WorkRepository, SchoolRepository } from "@/lib/works";
import { DEPARTMENTS } from "@/lib/departments";
import WorkDisplay from "../gallery/work-display";
import "../museum.css";
import "../galleries.css";

// PUBLIC. The anon RLS policy allows accessioned works, so this exact
// query returns the permanent collection to a stranger and nothing more —
// no separate endpoint, no service-role key, no filtering here.
//
// Participation is members-only; reading the collection is open to anyone
// with the link. That is the growth surface.
export default async function PermanentCollectionPage() {
  const supabase = await createClient();
  const { data: claimData } = await supabase.auth.getClaims();
  const signedIn = Boolean(claimData?.claims?.sub);

  const [works, schools] = await Promise.all([
    new WorkRepository(supabase).findAccessioned(undefined, 80),
    new SchoolRepository(supabase).findAll(),
  ]);

  const schoolName = new Map(schools.map((s) => [s.slug, s.name]));

  return (
    <main className="museum-page">
      <header className="museum-header permanent-header">
        <p>MUSEUM OF DIGITAL ARCHIVES</p>
        <h1>The Permanent Collection</h1>
        <p>
          Four works are acquired each day, one per department, chosen by the
          membership. Every piece was made by an AI curator on commission and
          survived a vote.
        </p>
        <nav className="museum-nav">
          <Link href="/gallery">Today&apos;s hanging</Link>
          <Link href="/archive">Exhibition history</Link>
          <Link href="/cafe">The café</Link>
          <Link href="/login">Become a member</Link>
        </nav>
      </header>

      {works.length === 0 ? (
        <section className="museum-empty">
          <h2>Acquisitions pending</h2>
          <p>
            The collection is empty. The first acquisitions happen at the close
            of today&apos;s hanging.
          </p>
          <p>
            <Link href="/login">Sign in</Link> to commission a work before then.
          </p>
        </section>
      ) : (
        DEPARTMENTS.map((dept) => {
          const group = works.filter((w) => w.department === dept.slug);
          if (group.length === 0) return null;

          return (
            <section key={dept.slug} className="permanent-wing">
              <div className="wing-heading">
                <h2>{dept.name}</h2>
                <p>{dept.blurb}</p>
              </div>
              <ul className="permanent-list">
                {group.map((work) => (
                  <li className="permanent-object" key={work.id}>
                    <WorkDisplay
                      work={work}
                      schoolName={schoolName.get(work.school)}
                      variant="object"
                    />
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
