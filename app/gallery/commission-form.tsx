"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { School } from "@/lib/works";
import type { Department } from "@/lib/departments";
import { svgToDataUri } from "@/lib/svg-sanitize";
import { isEditableDepartment } from "@/lib/work-limits";
import type { StreamEvent } from "../api/commission/route";
import CommissionTrace, { emptyTrace, type TraceState } from "./commission-trace";
import WorkEditor from "./work-editor";

type Finished = Extract<StreamEvent, { type: "done" }>["work"];

// Shown to everyone, working only for members. A signed-out visitor can
// read the six schools and see exactly what commissioning would do — the
// form is just inert, with the reason stated on the button row. Hiding it
// made the feature invisible to the people most likely to want an account.
export default function CommissionForm({
  department,
  schools,
  remaining,
  subject,
  canInteract,
  interactionHref,
  interactionLabel,
}: {
  department: Department;
  schools: School[];
  remaining: number;
  subject: string;
  canInteract: boolean;
  interactionHref: string;
  interactionLabel: string;
}) {
  const router = useRouter();
  const [school, setSchool] = useState(schools[0]?.slug ?? "");
  const [trace, setTrace] = useState<TraceState | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const traceSchool = useRef(school);

  const pending = trace !== null && trace.phase !== "done" && trace.phase !== "failed";
  const isVisual = department.media === "svg";
  const exhausted = canInteract && remaining <= 0;
  const locked = !canInteract || exhausted;

  // Reads the endpoint's newline-delimited JSON and folds each event
  // into the trace. Chunks can split a line, so a remainder is carried.
  async function commission() {
    if (locked || pending) return;
    setMessage(null);
    setFinished(null);
    setRevealed(false);
    traceSchool.current = school;
    setTrace(emptyTrace());
    const patch = (p: Partial<TraceState>) => setTrace((t) => (t ? { ...t, ...p } : t));

    let done = false;
    try {
      const res = await fetch("/api/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: department.slug, school }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? `The press refused (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      for (;;) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        carry += decoder.decode(value, { stream: true });
        const lines = carry.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as StreamEvent;
          if (e.type === "start") {
            patch({ phase: "thinking", model: e.model, temperature: e.temperature, maxOutputTokens: e.maxOutputTokens });
          } else if (e.type === "retry") {
            setTrace((t) =>
              t ? { ...t, notes: [...t.notes, `the press is busy (${e.reason}); trying again in ${e.waitMs / 1000}s`] } : t
            );
          } else if (e.type === "thought") {
            setTrace((t) => (t ? { ...t, thoughts: t.thoughts + e.text } : t));
          } else if (e.type === "text") {
            setTrace((t) => (t ? { ...t, phase: "writing", text: t.text + e.text } : t));
          } else if (e.type === "done") {
            done = true;
            patch({ phase: "done", finishedAt: Date.now() });
            setFinished(e.work);
            router.refresh();
          } else if (e.type === "error") {
            throw new Error(e.message);
          }
        }
      }
      if (!done) throw new Error("The connection closed before the work was hung. Check the wall, then try again.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The curator is unavailable.";
      patch({ phase: "failed", finishedAt: Date.now(), error: msg });
    }
  }

  function reset() {
    setTrace(null);
    setFinished(null);
    setRevealed(false);
  }

  const traceSchoolName = schools.find((s) => s.slug === traceSchool.current)?.name ?? traceSchool.current;

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
          You&apos;ve used all three of today&apos;s commissions. The
          allowance is three a day across the whole museum, so choosing where
          to spend them is part of it. The walls rehang at midnight.
        </p>
      ) : (
        <p>
          {remaining} of 3 left today, across every department. The subject is
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
          className={pending ? "is-working" : undefined}
          onClick={commission}
          disabled={locked || pending}
          title={canInteract ? undefined : interactionLabel}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          <span>
            {pending
              ? isVisual
                ? "At the press…"
                : "The curator is writing…"
              : "Commission"}
          </span>
        </button>

        {!canInteract && (
          <a className="commission-signin" href={interactionHref}>
            {interactionLabel}
          </a>
        )}
      </div>

      {/* Generation takes a while and silence reads as breakage, so the
          wait is shown as the work being written, live. */}
      {trace && (
        <CommissionTrace
          key={trace.startedAt}
          state={trace}
          department={department.slug}
          schoolName={traceSchoolName}
          subject={subject}
          visual={isVisual}
          onRevealed={() => setRevealed(true)}
        />
      )}

      {pending && (
        <p className="commission-waiting">
          {isVisual
            ? "Visual commissions take longer, usually ten to twenty seconds."
            : "This usually takes a few seconds."}
        </p>
      )}

      {finished && revealed && (
        <div className="commission-result">
          <p className="museum-kicker">HUNG ON THE WALL · NO. {finished.id}</p>
          {finished.svgSource ? (
            <figure className={`plate plate-${finished.department} commission-result-plate`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgToDataUri(finished.svgSource)} alt={finished.title ?? "Your new work"} />
              {finished.title && <figcaption>{finished.title}</figcaption>}
            </figure>
          ) : finished.body && isEditableDepartment(finished.department) ? (
            <WorkEditor
              key={finished.id}
              workId={finished.id}
              department={finished.department}
              initial={finished.body}
              onSaved={() => router.refresh()}
            />
          ) : null}
          <button type="button" className="work-editor-quiet commission-again" onClick={reset}>
            {remaining > 0 ? "Commission another" : "Close"}
          </button>
        </div>
      )}

      {isVisual && canInteract && !pending && (
        <p className="commission-caveat">
          Visual commissions occasionally fail at the press. A failure
          doesn&apos;t count against your three.
        </p>
      )}

      {message && !pending && <p role="status">{message}</p>}
    </section>
  );
}
