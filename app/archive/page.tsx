import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WingRepository } from "@/lib/wings";
import { WorkRepository, SchoolRepository } from "@/lib/works";
import {
  ExhibitionRepository,
  groupByDay,
  OUTCOME_LABEL,
  OUTCOME_NOTE,
} from "@/lib/exhibitions";
import { findDepartment } from "@/lib/departments";
import WorkDisplay from "../gallery/work-display";
import "../museum.css";
import "../galleries.css";

// PUBLIC. The exhibitions table is readable by anon, and so is any
// acquired work, so a logged-out visitor reads the museum's complete
// history. Today's un-acquired work, every ballot and every profile stay
// private — all from RLS, not from filtering here.
//
// This page is the answer to "what happened on the days nobody showed up".
// A results table that only recorded winners could not tell an empty day
// from a day that never ran, so every department gets a row every day.
export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: claimData } = await supabase.auth.getClaims();
  const signedIn = Boolean(claimData?.claims?.sub);

  const [rows, wings, schools] = await Promise.all([
    new ExhibitionRepository(supabase).findRecent(30),
    new WingRepository(supabase).findAll(),
    new SchoolRepository(supabase).findAll(),
  ]);

  const days = groupByDay(rows);
  const wingById = new Map(wings.map((w) => [w.id, w]));
  const schoolName = new Map(schools.map((s) => [s.slug, s.name]));

  const winnerIds = rows
    .map((r) => r.winner_work_id)
    .filter((id): id is number => id !== null);
  const winners = await new WorkRepository(supabase).findByIds(winnerIds);

  return (
    <main className="museum-page archive-page">
      <header className="museum-header permanent-header">
        <p>MUSEUM OF DIGITAL ARCHIVES</p>
        <h1>Exhibition History</h1>
        <p>
          Every day the museum has been open, and what each department did
          with it. Days when nothing was made are recorded too — a
          museum&apos;s history includes the quiet weeks.
        </p>
        <nav className="museum-nav">
          <Link href="/gallery">Today&apos;s hanging</Link>
          <Link href="/permanent">The permanent collection</Link>
          <Link href="/cafe">The café</Link>
        </nav>
      </header>

      {days.length === 0 ? (
        <section className="museum-empty">
          <h2>No history yet</h2>
          <p>
            The museum hasn&apos;t closed a day yet. The first exhibition
            record appears after tonight&apos;s close.
          </p>
        </section>
      ) : (
        days.map((day) => {
          const wing = wingById.get(day.wing_id);
          const date = new Date(`${day.held_on}T12:00:00`);

          return (
            <section
              key={day.held_on}
              className={day.quiet ? "archive-day is-quiet" : "archive-day"}
            >
              <div className="archive-day-head">
                <h2>
                  {date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                <p className="joke-meta">
                  {wing?.name ?? "—"}
                  {wing && ` · ${wing.era_label}`}
                </p>
                <p className="archive-summary">
                  {day.quiet
                    ? "The museum stood empty. No commissions in any department."
                    : `${day.acquiredCount} of 4 departments acquired.`}
                </p>
              </div>

              <ul className="archive-results">
                {day.departments.map((ex) => {
                  const dept = findDepartment(ex.department);
                  const winner = ex.winner_work_id
                    ? winners.get(ex.winner_work_id)
                    : undefined;

                  return (
                    <li
                      key={ex.id}
                      className={`archive-result outcome-${ex.outcome}`}
                    >
                      <h3>{dept?.shortName ?? ex.department}</h3>
                      <p className="archive-outcome">{OUTCOME_LABEL[ex.outcome]}</p>
                      <p className="archive-outcome-note">
                        {OUTCOME_NOTE[ex.outcome]}
                      </p>
                      <p className="joke-meta">
                        {ex.works_submitted}{" "}
                        {ex.works_submitted === 1 ? "work" : "works"} ·{" "}
                        {ex.votes_cast} {ex.votes_cast === 1 ? "vote" : "votes"}
                        {ex.top_score !== null &&
                          ` · top ${ex.top_score > 0 ? "+" : ""}${ex.top_score}`}
                      </p>

                      {winner && (
                        <WorkDisplay
                          work={winner}
                          schoolName={schoolName.get(winner.school)}
                          variant="card"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
