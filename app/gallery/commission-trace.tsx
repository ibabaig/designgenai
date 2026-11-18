"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// The loading screen, made legible. While the curator is writing, the
// visitor watches it happen in an editor: what was asked for, what the
// model is thinking (as comments), and the work itself arriving chunk by
// chunk. Prints and Film show the SVG source being drawn, tag by tag.
//
// Every colour is one of the museum's five inks. Nothing here is
// rendered as HTML: the model's text goes in as text nodes only.

export type TraceState = {
  phase: "connecting" | "thinking" | "writing" | "done" | "failed";
  model: string | null;
  temperature: number | null;
  maxOutputTokens: number | null;
  thoughts: string;
  text: string;
  notes: string[];
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
};

export const emptyTrace = (): TraceState => ({
  phase: "connecting",
  model: null,
  temperature: null,
  maxOutputTokens: null,
  thoughts: "",
  text: "",
  notes: [],
  startedAt: Date.now(),
  finishedAt: null,
  error: null,
});

type Tok = { t: string; k: "plain" | "comment" | "key" | "str" | "tag" | "attr" | "val" | "punct" };
type Line = Tok[];

// SVG arrives as one enormous line. Break it between tags so it reads
// like source, then colour tags, attribute names and values.
function svgLines(src: string): Line[] {
  const pretty = src.replace(/>\s*</g, ">\n<");
  return pretty.split("\n").map((raw) => {
    const toks: Line = [];
    const re = /(<\/?[a-zA-Z][\w:-]*)|([\w:-]+)(=)("[^"]*"?)|(\/?>)|([^<>="\s]+|\s+|[=<>"])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      if (m[1]) toks.push({ t: m[1], k: "tag" });
      else if (m[2]) {
        toks.push({ t: m[2], k: "attr" }, { t: m[3], k: "punct" }, { t: m[4], k: "val" });
      } else if (m[5]) toks.push({ t: m[5], k: "tag" });
      else toks.push({ t: m[6], k: "plain" });
    }
    return toks;
  });
}

// Thought summaries arrive as markdown (**Heading**, `code`). In a code
// comment the asterisks are noise, so they are dropped.
function comment(text: string): Line[] {
  const plain = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  return plain.split("\n").map((l) => [{ t: l ? `// ${l}` : "//", k: "comment" as const }]);
}

function build(
  s: TraceState,
  meta: { department: string; schoolName: string; subject: string; visual: boolean; revealed: boolean }
): { lines: Line[]; caretLine: number } {
  const lines: Line[] = [];
  const kv = (k: string, v: string) =>
    lines.push([{ t: k.padEnd(10), k: "key" }, { t: v, k: "str" }]);

  lines.push([{ t: `// MoDA · commission.${meta.department}`, k: "comment" }]);
  kv("subject", meta.subject);
  kv("school", meta.schoolName);
  kv("model", s.model ?? "…");
  if (s.temperature !== null) {
    kv("budget", `temperature ${s.temperature} · ${s.maxOutputTokens} tokens`);
  }
  lines.push([]);

  for (const n of s.notes) lines.push([{ t: `// ${n}`, k: "comment" }]);
  if (s.notes.length) lines.push([]);

  if (!s.text && !s.thoughts && s.phase !== "failed") {
    lines.push([{ t: s.phase === "connecting" ? "// assembling the prompt chain…" : "// waiting for the first words…", k: "comment" }]);
  }

  if (s.thoughts) {
    lines.push([{ t: "/* thinking */", k: "comment" }]);
    // Long summaries are kept to their last stretch while writing so the
    // work itself stays in view; all of it is there once finished.
    const t = s.phase === "thinking" || s.phase === "done" || s.phase === "failed"
      ? s.thoughts
      : s.thoughts.split("\n").slice(-6).join("\n");
    lines.push(...comment(t.trim()));
    lines.push([]);
  }

  if (meta.visual) {
    if (s.text) lines.push(...svgLines(s.text));
  } else {
    lines.push([{ t: "const ", k: "punct" }, { t: "work", k: "key" }, { t: " = `", k: "punct" }]);
    const body = s.text.replace(/^\s+/, "");
    for (const l of body.split("\n")) lines.push([{ t: l, k: "str" }]);
    if (s.phase === "done" && meta.revealed) lines.push([{ t: "`;", k: "punct" }]);
  }

  return { lines, caretLine: lines.length - 1 };
}

function clock(ms: number): string {
  const s = ms / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export default function CommissionTrace({
  state,
  department,
  schoolName,
  subject,
  visual,
  onRevealed,
}: {
  state: TraceState;
  department: string;
  schoolName: string;
  subject: string;
  visual: boolean;
  onRevealed?: () => void;
}) {
  // The fast models return a joke in well under a second, in three or four
  // chunks: too quick to watch. So the text is typed out at a readable
  // pace, but never more than about a second and a half behind the model.
  const [shown, setShown] = useState(0);
  const total = state.text.length;
  useEffect(() => {
    if (shown >= total) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(total);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const base = visual ? 900 : 38; // chars per second
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setShown((n) => {
        const behind = total - n;
        const rate = Math.max(base, behind / 1.5);
        return Math.min(total, n + Math.max(1, Math.round(rate * dt)));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown >= total, total, visual]); // eslint-disable-line react-hooks/exhaustive-deps

  const revealed = shown >= total;
  const finished = state.phase === "done" || state.phase === "failed";
  const reported = useRef(false);
  useEffect(() => {
    if (finished && revealed && !reported.current) {
      reported.current = true;
      onRevealed?.();
    }
  }, [finished, revealed, onRevealed]);

  const view = useMemo(() => ({ ...state, text: state.text.slice(0, shown) }), [state, shown]);
  const live = !(finished && revealed);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [live]);

  const { lines, caretLine } = useMemo(
    () => build(view, { department, schoolName, subject, visual, revealed }),
    [view, department, schoolName, subject, visual, revealed]
  );

  // Follow the writing, unless the visitor has scrolled up to read.
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines.length, view.text, state.thoughts]);

  const elapsed = (state.finishedAt ?? now) - state.startedAt;
  const chars = Array.from(view.text.trim()).length;
  const status =
    state.phase === "failed" ? "stopped"
    : state.phase === "connecting" ? "connecting to the press"
    : state.phase === "thinking" && !view.text ? (state.thoughts ? "thinking" : "waiting")
    : !(finished && revealed) ? (visual ? "drawing" : "writing")
    : "hung on the wall";

  return (
    <figure className={`trace trace-${finished && !revealed ? "writing" : state.phase}${visual ? " trace-svg" : ""}`} aria-label="The curator writing your commission">
      <div className="trace-bar">
        <span className="trace-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="trace-file">{department}/{visual ? "plate.svg" : "work.txt"}</span>
        <span className="trace-clock">{clock(elapsed)}</span>
      </div>

      <div
        className="trace-code"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        <ol>
          {lines.map((line, i) => (
            <li key={i}>
              {line.length === 0 ? " " : line.map((tok, j) => (
                <span key={j} className={`tk-${tok.k}`}>{tok.t}</span>
              ))}
              {live && i === caretLine && <span className="trace-caret" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>

      <figcaption className="trace-status" role="status" aria-live="polite">
        <span className="trace-led" aria-hidden="true" />
        <span>{status}</span>
        <span className="trace-status-right">
          {chars} chars{state.model ? ` · ${state.model}` : ""}
        </span>
      </figcaption>
      {state.error && <p className="trace-error" role="alert">{state.error}</p>}
    </figure>
  );
}
