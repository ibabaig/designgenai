"use client";

import { useId, useRef, useState, useTransition } from "react";
import { rewordWork } from "./actions";
import { BODY_LIMITS, countChars, type EditableDepartment } from "@/lib/work-limits";

// Rewording a joke or poem the member commissioned. The cap is enforced
// as you type (a paste is cut at the limit, never silently accepted and
// refused later), drawn as a meter, and checked again on the server and
// by the database trigger in 012.
export default function WorkEditor({
  workId,
  department,
  initial,
  onSaved,
  onCancel,
  cancelLabel = "Cancel",
  autoFocus = false,
}: {
  workId: number;
  department: EditableDepartment;
  initial: string;
  onSaved?: (body: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  autoFocus?: boolean;
}) {
  const limit = BODY_LIMITS[department];
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const capFlash = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [capped, setCapped] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  const used = countChars(value);
  const left = limit - used;
  const ratio = Math.min(1, used / limit);
  const level = used > limit ? "over" : ratio >= 0.9 ? "near" : ratio >= 0.75 ? "warm" : "ok";
  const changed = value.trim() !== saved.trim();
  const blank = value.trim() === "";

  function flashCap() {
    setCapped(true);
    if (capFlash.current) clearTimeout(capFlash.current);
    capFlash.current = setTimeout(() => setCapped(false), 1400);
  }

  // `caret` is where the browser left the cursor after the edit. Growing
  // past the cap is refused; shrinking is always allowed, even when an
  // older wording starts out over the limit. A paste that only partly
  // fits keeps what fits and drops the rest of the PASTE, never the end
  // of the work.
  function change(next: string, caret: number | null) {
    setError(null);
    setNote(null);
    const n = countChars(next);
    if (n > limit && n > used) {
      flashCap();
      const room = Math.max(0, Math.max(limit, used) - used);
      const excess = n - used - room;
      if (room === 0 || caret === null) return; // full: the keystroke is refused
      const chars = Array.from(next);
      const at = countChars(next.slice(0, caret));
      chars.splice(at - excess, excess);
      next = chars.join("");
      const pos = chars.slice(0, at - excess).join("").length;
      requestAnimationFrame(() => textarea.current?.setSelectionRange(pos, pos));
    }
    setValue(next);
  }

  function save() {
    if (!changed || blank || used > limit) return;
    startTransition(async () => {
      const r = await rewordWork(workId, department, value);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      const body = r.body ?? value.trim();
      setValue(body);
      setSaved(body);
      setNote("Saved. The wall now shows your wording.");
      onSaved?.(body);
    });
  }

  return (
    <div className={`work-editor is-${level}`}>
      <label className="work-editor-label" htmlFor={`${id}-text`}>
        {department === "poetry" ? "Your poem" : "Your joke"} — reword it if you like
      </label>
      <textarea
        id={`${id}-text`}
        className={`work-editor-text work-editor-${department}`}
        value={value}
        ref={textarea}
        onChange={(e) => change(e.target.value, e.target.selectionEnd)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
        }}
        rows={department === "poetry" ? 8 : 3}
        autoFocus={autoFocus}
        disabled={pending}
        aria-describedby={`${id}-meter`}
        spellCheck
      />

      <div className="work-meter" id={`${id}-meter`}>
        <div
          className="work-meter-track"
          role="meter"
          aria-label="Characters used"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${used} of ${limit} characters`}
        >
          <span className="work-meter-fill" style={{ width: `${ratio * 100}%` }} />
          {[0.25, 0.5, 0.75].map((t) => (
            <i key={t} className="work-meter-tick" style={{ left: `${t * 100}%` }} aria-hidden="true" />
          ))}
        </div>
        <p className="work-meter-count">
          <strong>{used}</strong> / {limit}
          <span className="work-meter-left">
            {capped ? "That's the limit" : left >= 0 ? `${left} left` : `${-left} over — trim to save`}
          </span>
        </p>
        {/* Spoken only at the thresholds, not on every keystroke. */}
        <span className="visually-hidden" aria-live="polite">
          {level === "near" ? `${left} characters left` : level === "over" ? "Over the limit" : ""}
        </span>
      </div>

      <div className="work-editor-actions">
        <button type="button" onClick={save} disabled={!changed || blank || used > limit || pending}>
          {pending ? "Saving…" : "Save wording"}
        </button>
        {changed && !pending && (
          <button type="button" className="work-editor-quiet" onClick={() => setValue(saved)}>
            Undo changes
          </button>
        )}
        {onCancel && !pending && (
          <button type="button" className="work-editor-quiet" onClick={onCancel}>
            {cancelLabel}
          </button>
        )}
      </div>
      {error && <p className="work-editor-error" role="alert">{error}</p>}
      {note && !changed && <p className="work-editor-note" role="status">{note}</p>}
    </div>
  );
}
