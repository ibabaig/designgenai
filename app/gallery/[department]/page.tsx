import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import {
  SchoolRepository,
  WorkRepository,
  VoteRepository,
  houseWork,
  memberWorks,
} from "@/lib/works";
import { findDepartment, isDepartmentSlug } from "@/lib/departments";
import DepartmentNav from "../department-nav";
import WorkDisplay from "../work-display";
import CommissionForm from "../commission-form";
import VoteButtons from "../vote-buttons";
import WithdrawWork from "../withdraw-work";
import EditWork from "../edit-work";
import { isEditableDepartment } from "@/lib/work-limits";
import "../../museum.css";
import "../../galleries.css";

// Next 16: params is a Promise.
export default async function DepartmentGallery({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: slug } = await params;
  if (!isDepartmentSlug(slug)) notFound();
  const department = findDepartment(slug)!;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;
  const canInteract = Boolean(userId && isComplete(profile));

  const works = new WorkRepository(supabase);
  const [wing, schools, onView, counts] = await Promise.all([
    new WingRepository(supabase).findCurrent(),
    new SchoolRepository(supabase).findByDepartment(slug),
    works.findInDepartmentToday(slug),
    works.countsToday(),
  ]);

  const [myVotes, mineToday] = canInteract
    ? await Promise.all([
        new VoteRepository(supabase).findMine(),
        works.countMineToday(userId!),
      ])
    : ([new Map<number, -1 | 1>(), 0] as const);

  const schoolName = new Map(schools.map((s) => [s.slug, s.name]));

  // Two displays, deliberately. The house commission is what the museum
  // hung at midnight — it is on the wall for everyone the moment the
  // gallery opens. Below it is what the membership brought. Both are
  // readable by anyone and votable only by members, and both compete
  // for tonight's acquisition.
  const house = houseWork(onView);
  const submissions = memberWorks(onView);

  const interactionHref = userId ? "/onboarding" : `/login?next=/gallery/${slug}`;
  const interactionLabel = userId ? "Finish your profile" : "Member sign in";

  const ballot = (w: (typeof onView)[number]) => (
    <>
      <VoteButtons
        workId={w.id}
        department={slug}
        score={w.score}
        voteCount={w.vote_count}
        myVote={myVotes.get(w.id)}
        isMine={w.author_id === userId}
        isSignedIn={canInteract}
        interactionHref={interactionHref}
        interactionLabel={interactionLabel}
      />
      {w.origin === "member" && w.author_id === userId && (
        <WithdrawWork workId={w.id} department={slug} />
      )}
      {w.origin === "member" &&
        w.author_id === userId &&
        canInteract &&
        !w.accessioned_at &&
        w.body &&
        isEditableDepartment(slug) && (
          <EditWork workId={w.id} department={slug} body={w.body} />
        )}
    </>
  );

  return (
    <main className="museum-page museum-gallery">
      <header className="museum-header">
        <p>
          <Link href="/gallery">MUSEUM OF DIGITAL ARCHIVES</Link> ·{" "}
          {wing.name.toUpperCase()}
        </p>
        <h1>{department.shortName}</h1>
        <p>{department.blurb}</p>
        <p className="wing-subject">Today&apos;s subject: {wing.subject}</p>
        <nav className="museum-nav">
          <Link href="/gallery">All departments</Link>
          <Link href="/permanent">The permanent collection</Link>
          <Link href="/archive">Exhibition history</Link>
        </nav>
      </header>

      <DepartmentNav active={slug} counts={counts} />

      {/* ---- the museum's own commission ---- */}
      <section className="house-commission">
        <p className="museum-kicker">COMMISSIONED BY THE MUSEUM · HUNG AT MIDNIGHT</p>
        <h2>Today&apos;s commission</h2>
        {house ? (
          <article className="joke-card joke-card-leading">
            <WorkDisplay
              work={house}
              schoolName={schoolName.get(house.school)}
              variant="leading"
            />
            {ballot(house)}
          </article>
        ) : (
          <div className="museum-empty">
            <p>
              The museum hasn&apos;t hung its own work in {department.shortName}{" "}
              today. It arrives with the midnight commission.
            </p>
          </div>
        )}
      </section>

      {/* ---- what the membership brought ---- */}
      <section className="member-submissions">
        <p className="museum-kicker">COMMISSIONED BY MEMBERS</p>
        <h2>
          Submissions{submissions.length > 0 && ` (${submissions.length})`}
        </h2>

        {submissions.length === 0 ? (
          <div className="museum-empty">
            <p>
              No member has hung anything in {department.shortName} today. The
              museum&apos;s own work leads by default — though a work nobody
              votes for is not acquired.
            </p>
          </div>
        ) : (
          <ul className="joke-list">
            {submissions.map((work) => (
              <li className="joke-card" key={work.id}>
                <WorkDisplay
                  work={work}
                  schoolName={schoolName.get(work.school)}
                  variant="card"
                />
                {ballot(work)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="commission-panel">
        <CommissionForm
          department={department}
          schools={schools}
          remaining={Math.max(0, 3 - mineToday)}
          subject={wing.subject}
          canInteract={canInteract}
          interactionHref={interactionHref}
          interactionLabel={interactionLabel}
        />
      </div>
    </main>
  );
}
