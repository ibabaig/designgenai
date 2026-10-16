"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commissionWork } from "./actions";
import type { School } from "@/lib/works";
import type { Department } from "@/lib/departments";

// Shown to everyone, working only for members. A signed-out visitor can
// read the six schools and see exactly what commissioning would do —
// the form is just inert, with the reason stated on the button row.
// Hiding it entirely made the feature invisible to the people most
// likely to want an account.
export default function CommissionForm({
  department,
  schools,
  remaining,
  canInteract,
  interactionHref,
  interactionLabel,
}: {
  department: Department;
  schools: School[];
  remaining: number;
  canInteract: boolean;
  interactionHref: string;
  interactionLabel: string;
}) {
  const router = useRouter();
  const [school, setSchool] = useState(schools[0]?.slug ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isVisual = department.media === "svg";
  const exhausted = canInteract && remaining <= 0;
  const locked = !canInteract || exhausted;

  function commission() {
    if (locked) return;
    setMessage(null);
    startTransition(async () => {
      const result = await commissionWork(department.slug, school);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="commission-panel-inner">
      <h2>Commission a work</h2>

      {!canInteract ? (
        <p>
          Members commission the work in this gallery. Pick a school to see
          what each one does — you&apos;ll need an account to send one to the
          press.
        </p>
      ) : exhausted ? (
        <p>
          You&apos;ve made all three of today&apos;s works for{" "}
          {department.shortName}. Your allowance is per department, so the
          other three galleries are still open to you.
        </p>
      ) : (
        <p>
          {remaining} of 3 left in {department.shortName} today. The subject is
          fixed — the school decides everything else.
        </p>
      )}

      <fieldset className="school-options" disabled={pending}>
        <legend>School</legend>
        {schools.map((s) => (
          <label key={s.slug}>
            <input
              type="radio"
              name="school"
              value={s.slug}
              checked={school === s.slug}
              onChange={() => setSchool(s.slug)}
            />
            <span className="school-copy">
              <strong>{s.name}</strong>
              <small>{s.blurb}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="commission-actions">
        <button
          type="button"
          onClick={commission}
          disabled={locked || pending || !school}
          title={canInteract ? undefined : interactionLabel}
        >
          {pending
            ? isVisual
              ? "At the press…"
              : "The curator is writing…"
            : "Commission"}
        </button>

        {!canInteract && (
          <a className="commission-signin" href={interactionHref}>
            {interactionLabel}
          </a>
        )}
      </div>

      {isVisual && canInteract && (
        <p className="commission-caveat">
          Visual commissions take a few seconds and occasionally fail at the
          press. A failure doesn&apos;t count against your three.
        </p>
      )}

      {message && <p role="status">{message}</p>}
    </section>
  );
}
