"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawWork } from "./actions";

// Only rendered for your own, not-yet-accessioned work. The RLS delete
// policy is the real guard; this is the affordance.
export default function WithdrawWork({
  workId,
  department,
}: {
  workId: number;
  department: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawWork(workId, department);
      if (!result.ok) setError(result.message);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button className="withdraw-link" onClick={() => setConfirming(true)} disabled={pending}>
        Withdraw
      </button>
    );
  }

  return (
    <span className="withdraw-confirm">
      Withdraw this work and its votes?{" "}
      <button onClick={remove} disabled={pending}>
        {pending ? "Withdrawing…" : "Yes"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={pending}>
        Leave it up
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
