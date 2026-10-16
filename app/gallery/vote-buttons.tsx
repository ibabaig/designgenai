"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote, retractVote } from "./actions";

// The arrows are ALWAYS rendered. When you are not signed in they are
// disabled rather than replaced by a text link — the affordance stays
// visible so a visitor can see the work is votable, and the reason is
// stated next to it. Generated content is readable by anyone;
// modifying it requires a member.
//
// Disabling is a courtesy, not the control. The real guard is the RLS
// insert policy on votes, which no amount of devtools will get past.
export default function VoteButtons({
  workId,
  department,
  score,
  voteCount,
  myVote,
  isMine,
  isSignedIn,
  interactionHref,
  interactionLabel,
}: {
  workId: number;
  department: string;
  score: number;
  voteCount: number;
  myVote: -1 | 1 | undefined;
  isMine: boolean;
  isSignedIn: boolean;
  interactionHref: string;
  interactionLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tally = `${score > 0 ? "+" : ""}${score} · ${voteCount} ${
    voteCount === 1 ? "vote" : "votes"
  }`;

  // Your own work: you get the tally, never a ballot. The RLS insert
  // policy enforces this too.
  const locked = isMine || !isSignedIn;
  const reason = isMine ? "your work" : null;

  function vote(value: -1 | 1) {
    if (locked) return;
    setError(null);
    startTransition(async () => {
      // Clicking your existing vote again withdraws it.
      const result =
        myVote === value
          ? await retractVote(workId, department)
          : await castVote(workId, value, department);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <div className={locked ? "ballot is-locked" : "ballot"}>
      <button
        type="button"
        className={myVote === 1 ? "is-cast" : undefined}
        onClick={() => vote(1)}
        disabled={locked || pending}
        aria-pressed={myVote === 1}
        aria-label={isSignedIn ? "Worth acquiring" : "Sign in to vote"}
        title={isSignedIn ? "Worth acquiring" : "Sign in to vote"}
      >
        ▲
      </button>

      <span className="ballot-tally">{tally}</span>

      <button
        type="button"
        className={myVote === -1 ? "is-cast" : undefined}
        onClick={() => vote(-1)}
        disabled={locked || pending}
        aria-pressed={myVote === -1}
        aria-label={isSignedIn ? "Return to storage" : "Sign in to vote"}
        title={isSignedIn ? "Return to storage" : "Sign in to vote"}
      >
        ▼
      </button>

      {reason && <span className="ballot-note">{reason}</span>}

      {!isSignedIn && (
        <a className="ballot-signin" href={interactionHref}>
          {interactionLabel}
        </a>
      )}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
