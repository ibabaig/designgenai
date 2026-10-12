import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { WingRepository } from "@/lib/wings";
import { JokeRepository, VoteRepository, accessionNumber } from "@/lib/jokes";
import { findSchool } from "@/lib/schools";
import CommissionForm from "./commission-form";
import VoteButtons from "./vote-buttons";
import WithdrawJoke from "./withdraw-joke";
import "../museum.css";

// Public reading surface. RLS controls which jokes the anonymous client can
// read; voting and commissioning remain behind verified server actions.
export default async function GalleryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;
  const canInteract = Boolean(userId && isComplete(profile));

  const wing = await new WingRepository(supabase).findCurrent();
  const jokes = new JokeRepository(supabase);

  const works = await jokes.findInWingToday(wing.id);
  const [myVotes, mineToday] = canInteract
    ? await Promise.all([
        new VoteRepository(supabase).findMine(),
        jokes.countMineToday(userId!),
      ])
    : [new Map<number, -1 | 1>(), 0] as const;

  const [leading, ...rest] = works;

  return (
    <main className="museum-page museum-gallery">
      <header className="museum-header">
        <p>MUSEUM OF DIGITAL ART · TODAY&apos;S HANGING</p>
        <h1>{wing.name}</h1>
        <p>{wing.era_label}</p>
        <p>{wing.blurb}</p>
        <p>The gallery closes at midnight. Whatever leads then is acquired for the permanent collection.</p>
        <nav className="museum-nav">
          <Link href="/permanent">The permanent collection</Link>
          {canInteract ? <Link href="/profile">Profile</Link> : <Link href="/login?next=/gallery">Member sign in to participate</Link>}
        </nav>
      </header>

      {works.length === 0 ? (
        <section className="museum-empty">
          <h2>The walls are bare</h2>
          <p>
            Nothing has been hung in {wing.name} today. Commission the first
            work and it leads by default — though a work nobody votes for is
            not acquired.
          </p>
        </section>
      ) : (
        <>
          <section className="museum-leading">
            <p className="museum-kicker">THE WORK CURRENTLY IN FRONT</p>
            <h2>Leading acquisition</h2>
            <article className="joke-card joke-card-leading">
              <p className="joke-meta">
                {accessionNumber(leading)} · {findSchool(leading.school)?.name}
              </p>
              <blockquote className="joke-body">{leading.body}</blockquote>
              <VoteButtons
                jokeId={leading.id}
                score={leading.score}
                voteCount={leading.vote_count}
                myVote={myVotes.get(leading.id)}
                isMine={leading.author_id === userId}
                isSignedIn={canInteract}
                interactionHref={userId ? "/onboarding" : "/login?next=/gallery"}
                interactionLabel={userId ? "Complete your profile to vote" : "Sign in to vote"}
              />
              {leading.author_id === userId && <WithdrawJoke jokeId={leading.id} />}
            </article>
          </section>

          {rest.length > 0 && (
            <section className="museum-also">
              <h2>Also on view</h2>
              <ul className="joke-list">
                {rest.map((joke) => (
                  <li className="joke-card" key={joke.id}>
                    <p className="joke-meta">
                      {accessionNumber(joke)} · {findSchool(joke.school)?.name}
                    </p>
                    <blockquote className="joke-body">{joke.body}</blockquote>
                    <VoteButtons
                      jokeId={joke.id}
                      score={joke.score}
                      voteCount={joke.vote_count}
                      myVote={myVotes.get(joke.id)}
                      isMine={joke.author_id === userId}
                      isSignedIn={canInteract}
                      interactionHref={userId ? "/onboarding" : "/login?next=/gallery"}
                      interactionLabel={userId ? "Complete your profile to vote" : "Sign in to vote"}
                    />
                    {joke.author_id === userId && <WithdrawJoke jokeId={joke.id} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="commission-panel">
        {canInteract ? (
          <CommissionForm remaining={Math.max(0, 3 - mineToday)} wingName={wing.name} />
        ) : (
          <section className="commission-panel-inner">
            <h2>Join the membership</h2>
            <p>Read the gallery freely. Sign in with a complete profile to commission a joke, vote, or withdraw your own work.</p>
            <Link className="museum-action-link" href={userId ? "/onboarding" : "/login?next=/gallery"}>
              {userId ? "Complete your profile" : "Member sign in"}
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
