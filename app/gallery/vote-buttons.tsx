"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote, retractVote } from "./actions";

export default function VoteButtons({
  jokeId,
  score,
  voteCount,
  myVote,
  isMine,
  isSignedIn,
  interactionHref,
  interactionLabel,
}: {
  jokeId: number;
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

  // You wrote it, so you don't get a ballot. The RLS insert policy
  // enforces this too; hiding the buttons just avoids offering an
  // action that would fail.
  if (isMine) {
    return <p>{tally} · your work</p>;
  }

  if (!isSignedIn) {
    return (
      <p className="public-vote-prompt">
        {tally} · <a href={interactionHref}>{interactionLabel}</a>
      </p>
    );
  }

  function vote(value: -1 | 1) {
    setError(null);
    startTransition(async () => {
      // Clicking your existing vote again withdraws it.
      const result =
        myVote === value
          ? await retractVote(jokeId)
          : await castVote(jokeId, value);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={() => vote(1)}
        disabled={pending}
        aria-pressed={myVote === 1}
        aria-label="Worth acquiring"
      >
        ▲
      </button>

      <span>{tally}</span>

      <button
        onClick={() => vote(-1)}
        disabled={pending}
        aria-pressed={myVote === -1}
        aria-label="Return to storage"
      >
        ▼
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
