import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import { SchoolRepository, WorkRepository, VoteRepository } from "@/lib/works";
import { findDepartment, isDepartmentSlug } from "@/lib/departments";
import DepartmentNav from "../department-nav";
import WorkDisplay from "../work-display";
import CommissionForm from "../commission-form";
import VoteButtons from "../vote-buttons";
import WithdrawWork from "../withdraw-work";
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
        works.countMineToday(userId!, slug),
      ])
    : ([new Map<number, -1 | 1>(), 0] as const);

  const schoolName = new Map(schools.map((s) => [s.slug, s.name]));
  const [leading, ...rest] = onView;

  const interactionHref = userId ? "/onboarding" : `/login?next=/gallery/${slug}`;
  const interactionLabel = userId ? "Complete your profile to vote" : "Sign in to vote";

  return (
    <main className="museum-page museum-gallery">
      <header className="museum-header">
        <p>
          <Link href="/gallery">MUSEUM OF DIGITAL ART</Link> · {wing.name.toUpperCase()}
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

      {onView.length === 0 ? (
        <section className="museum-empty">
          <h2>The walls are bare</h2>
          <p>
            Nothing has been hung in {department.shortName} today. Commission
            the first work — though a work nobody votes for is not acquired,
            so being alone here is not the same as winning.
          </p>
        </section>
      ) : (
        <>
          <section className="museum-leading">
            <p className="museum-kicker">THE WORK CURRENTLY IN FRONT</p>
            <h2>Leading acquisition</h2>
            <article className="joke-card joke-card-leading">
              <WorkDisplay
                work={leading}
                schoolName={schoolName.get(leading.school)}
                variant="leading"
              />
              <VoteButtons
                workId={leading.id}
                department={slug}
                score={leading.score}
                voteCount={leading.vote_count}
                myVote={myVotes.get(leading.id)}
                isMine={leading.author_id === userId}
                isSignedIn={canInteract}
                interactionHref={interactionHref}
                interactionLabel={interactionLabel}
              />
              {leading.author_id === userId && (
                <WithdrawWork workId={leading.id} department={slug} />
              )}
            </article>
          </section>

          {rest.length > 0 && (
            <section className="museum-also">
              <h2>Also on view</h2>
              <ul className="joke-list">
                {rest.map((work) => (
                  <li className="joke-card" key={work.id}>
                    <WorkDisplay
                      work={work}
                      schoolName={schoolName.get(work.school)}
                      variant="card"
                    />
                    <VoteButtons
                      workId={work.id}
                      department={slug}
                      score={work.score}
                      voteCount={work.vote_count}
                      myVote={myVotes.get(work.id)}
                      isMine={work.author_id === userId}
                      isSignedIn={canInteract}
                      interactionHref={interactionHref}
                      interactionLabel={interactionLabel}
                    />
                    {work.author_id === userId && (
                      <WithdrawWork workId={work.id} department={slug} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Always rendered. A signed-out visitor sees the six schools and an
          inert Commission button with the reason beside it, rather than the
          feature vanishing. Mutation is still gated at the server action and
          again by RLS. */}
      <div className="commission-panel">
        <CommissionForm
          department={department}
          schools={schools}
          remaining={Math.max(0, 3 - mineToday)}
          canInteract={canInteract}
          interactionHref={interactionHref}
          interactionLabel={userId ? "Finish your profile" : "Member sign in"}
        />
      </div>
    </main>
  );
}
