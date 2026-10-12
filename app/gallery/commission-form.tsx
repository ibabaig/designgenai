"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commissionJoke } from "./actions";
import { SCHOOLS } from "@/lib/schools";

export default function CommissionForm({
  remaining,
  wingName,
}: {
  remaining: number;
  wingName: string;
}) {
  const router = useRouter();
  const [school, setSchool] = useState<string>(SCHOOLS[0].slug);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const selected = SCHOOLS.find((s) => s.slug === school);
  const exhausted = remaining <= 0;

  function commission() {
    setMessage(null);
    startTransition(async () => {
      const result = await commissionJoke(school);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  if (exhausted) {
    return (
      <section>
        <h2>Commissions closed</h2>
        <p>
          You&apos;ve hung all three of today&apos;s works in {wingName}. A new
          gallery opens tomorrow. Until then, vote on what everyone else brought.
        </p>
      </section>
    );
  }

  return (
    <section className="commission-panel-inner">
      <h2>Commission a work</h2>
      <p>
        {remaining} of 3 left today. Pick a school — the same subject reads very
        differently depending who&apos;s writing.
      </p>

      <fieldset className="school-options" disabled={pending}>
        <legend>School</legend>
        {SCHOOLS.map((s) => (
          <label key={s.slug}>
            <input
              type="radio"
              name="school"
              value={s.slug}
              checked={school === s.slug}
              onChange={() => setSchool(s.slug)}
            />
            <span className="school-copy"><strong>{s.name}</strong><small>{s.blurb}</small></span>
            <small className="school-example-inline">“{s.example}”</small>
          </label>
        ))}
      </fieldset>

      {selected && (
        <figure className="school-example">
          <figcaption>A work in this school reads like:</figcaption>
          <blockquote>{selected.example}</blockquote>
        </figure>
      )}

      <button onClick={commission} disabled={pending}>
        {pending ? "The curator is writing…" : "Commission"}
      </button>

      {message && <p role="status">{message}</p>}
    </section>
  );
}
