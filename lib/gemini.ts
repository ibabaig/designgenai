import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import type { Wing } from "@/lib/wings";
import {
  findDepartment,
  PALETTE_FOR_PROMPT,
  type DepartmentSlug,
} from "@/lib/departments";
import { sanitiseSvg } from "@/lib/svg-sanitize";
import type { School } from "@/lib/works";
import type { createClient } from "@/lib/supabase/server";
import {
  closeRequest,
  openRequest,
  recordResponse,
  resolveChain,
  type ChainVars,
  type Origin,
} from "@/lib/prompt-pipeline";

// Passing this in switches generation from the literals below to the
// prompt chains in the database, and makes every attempt leave a record.
// It is optional so that generateWork() still works without a database
// handle -- and so that a failure to resolve a chain falls back to the
// literals rather than taking the museum offline.
export type GenContext = {
  db: Awaited<ReturnType<typeof createClient>>;
  requesterId: string | null;
  origin: Origin;
  // Set by the streaming commission endpoint. When present the model is
  // called with generateContentStream and every chunk is passed on as it
  // arrives, so the visitor watches the work being written instead of a
  // spinner. Absent (the nightly cron), the call is a plain request.
  onEvent?: (event: GenEvent) => void;
};

export type GenEvent =
  | { type: "start"; model: string; temperature: number; maxOutputTokens: number }
  | { type: "thought"; text: string }
  | { type: "retry"; attempt: number; waitMs: number; reason: string }
  | { type: "text"; text: string };

// `gemini-flash-latest` is the stable alias tracking the current Flash
// model. Override with GEMINI_MODEL to pin a version.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

// Naming the audience concretely keeps output specific rather than
// generically "college humour".
const AUDIENCE =
  "The audience is a university junior in New York City: chronically online, " +
  "originally from the Midwest, still fairly new to the city, living in a dorm, " +
  "exploring the city on weekends on very little money.";

const HOUSE_RULES = [
  "Be specific. Name a real detail, not a category.",
  "Keep it good-natured. Punch at situations, never at groups of people.",
  "No markdown, headings, bullets, quotation marks or emoji.",
];

export type Generation = {
  prompt: string;
  model: string;
  body?: string;
  svgSource?: string;
  title?: string;
  caption?: string;
  // The generation_requests row this came from, so the caller can link
  // the finished work to it. Null when there was no context to log with.
  requestId?: number | null;
};

// ---------------------------------------------------------------
// PROMPTS
// ---------------------------------------------------------------

function textPrompt(wing: Wing, school: School, department: DepartmentSlug): string {
  const form =
    department === "poetry"
      ? "a short poem for a broadside hung on a gallery wall"
      : "a short joke that hangs on a wall as the artwork itself";

  return [
    `You are writing ${form} for the Museum of Digital Archives.`,
    "",
    `GALLERY: ${wing.name} (${wing.era_label})`,
    `SUBJECT: ${wing.subject}`,
    "",
    AUDIENCE,
    "",
    `SCHOOL: ${school.name}`,
    school.blurb,
    schoolDirection(school.slug),
    "",
    "RULES",
    ...HOUSE_RULES.map((r) => `- ${r}`),
    department === "poetry"
      ? "- Under 14 lines. Line breaks matter; use them deliberately."
      : "- Be brief. A visitor reads this standing up.",
    "- Do not restate the gallery name or the subject; they are printed beside you.",
    "- Output the work only, nothing else.",
  ].join("\n");
}

// Per-school steering beyond the one-line blurb in the database. Kept here
// so prompt wording is reviewable in a diff.
function schoolDirection(slug: string): string {
  const d: Record<string, string> = {
    deadpan:
      "Flat affect. State the absurd thing as plain fact and stop. The humour is in what you refuse to acknowledge.",
    absurdist:
      "One surreal premise, total internal logic, escalate once, then stop at the funniest point.",
    observational:
      "One small specific true detail anyone who has been there recognises instantly. Precision, not exaggeration.",
    confessional:
      "Confess something faintly humiliating in the first person. No self-pity, no punchline signalling.",
    overshare:
      "Lowercase throughout, present tense, fragments allowed. Two or three beats, ending somewhere stranger than you started.",
    haiku:
      "Exactly three lines of 5, 7 and 5 syllables, separated by newlines. Count carefully. The turn lands on line three.",
    "free-verse": "No metre, no rhyme. Put the weight on where you break the line.",
    "prose-poem": "One dense paragraph. No line breaks. Prose rhythm, poem logic.",
    sonnet:
      "Fourteen lines, loose iambic pentameter, a turn around line nine. Rhyme only if it costs you nothing in sense.",
    concrete:
      "The arrangement on the page carries half the meaning. Use spacing and indentation as material.",
    elegy: "Grieve something small and unworthy of grief, with complete sincerity.",
    found:
      "Assemble the poem entirely from language that would really appear in this setting: signs, notices, announcements, overheard speech.",
  };
  return d[slug] ?? "";
}

// Everything a template can interpolate. {{examples}} and {{terms}} are
// filled by the pipeline itself, since both are database lookups.
function baseVars(wing: Wing, school: School, department: DepartmentSlug): ChainVars {
  const dept = findDepartment(department);
  return {
    "wing.name": wing.name,
    "wing.era_label": wing.era_label,
    "wing.subject": wing.subject,
    "school.name": school.name,
    "school.blurb": school.blurb,
    "school.direction": schoolDirection(school.slug),
    audience: AUDIENCE,
    house_rules: HOUSE_RULES.map((r) => `- ${r}`).join("\n"),
    palette: PALETTE_FOR_PROMPT,
    "canvas.w": String(dept?.canvas.w ?? 0),
    "canvas.h": String(dept?.canvas.h ?? 0),
  };
}

function svgPrompt(wing: Wing, school: School, department: DepartmentSlug): string {
  const dept = findDepartment(department)!;
  const { w, h } = dept.canvas;
  const isFilm = department === "film";

  return [
    isFilm
      ? "You are composing a single film still for the Museum of Digital Archives' Film department."
      : "You are composing a print for the Museum of Digital Archives' Prints department.",
    "You work in SVG. The SVG is the artwork.",
    "",
    `GALLERY: ${wing.name} (${wing.era_label})`,
    `SUBJECT: ${wing.subject}`,
    "",
    AUDIENCE,
    "",
    `SCHOOL: ${school.name}`,
    school.blurb,
    "",
    "TECHNICAL CONSTRAINTS — follow exactly, the output is rejected otherwise:",
    `- Canvas is viewBox="0 0 ${w} ${h}". Compose for that shape.`,
    `- Use ONLY these ink colours, by hex: ${PALETTE_FOR_PROMPT}.`,
    "- Begin with a full-canvas <rect> filled paper, then compose on top of it.",
    "- Allowed elements only: <g> <rect> <circle> <ellipse> <line> <polyline> <polygon> <path>.",
    "- No <text>, no <image>, no <use>, no gradients, no filters, no CSS, no script.",
    "- Flat fills only. To suggest overprinted ink, overlap shapes at fill-opacity 0.85.",
    "- Between 10 and 30 shapes. Bold and readable from across a room, not fiddly.",
    "- Build recognisable forms from simple geometry. A chair is legs and a back, not a mesh.",
    "- Use the red sparingly, as an accent on one element, the way a printer spends a second ink.",
    "",
    isFilm
      ? "COMPOSITION: one frame from a film that does not exist. Strong foreground subject, clear depth, cinematic framing. The viewer should feel they walked in mid-scene."
      : "COMPOSITION: a single clear subject with real negative space. Think poster, not illustration.",
    "",
    "Reply with exactly three lines, in this order and nothing else:",
    "TITLE: <three to six words, no quotation marks>",
    isFilm
      ? "LOGLINE: <one sentence, under 25 words, describing the film this frame is from>"
      : "PLATE: <one sentence, under 25 words, as a museum plate note>",
    "SVG: <the complete svg element on one line, starting with <svg and ending with </svg>>",
  ].join("\n");
}

// ---------------------------------------------------------------
// GENERATION
// ---------------------------------------------------------------

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local and to Vercel's " +
        "Environment Variables. It must NOT have a NEXT_PUBLIC_ prefix."
    );
  }
  // Without a timeout an overloaded model can hold a request open until
  // the function is killed, which reads to the visitor as a frozen page.
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } });
}

// Google answers "busy" with 503/504/429. Those are worth two more tries;
// anything else (a bad key, a retired model) fails at once.
const TRANSIENT = /\b(503|504|429|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|high demand|overloaded)\b/i;
const BACKOFF_MS = [2000, 6000];

async function withRetry<T>(run: () => Promise<T>, onEvent?: GenContext["onEvent"]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt >= BACKOFF_MS.length || !TRANSIENT.test(msg)) throw e;
      const waitMs = BACKOFF_MS[attempt];
      const code = msg.match(/\b(503|504|429)\b/)?.[1] ?? "busy";
      onEvent?.({ type: "retry", attempt: attempt + 1, waitMs, reason: code });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

// The one place the model is called. Returns the same shape whether it
// streamed or not, so the logging and post-processing below stay single.
type ModelResult = {
  text: string | undefined;
  candidates?: Array<{ finishReason?: string }>;
  usageMetadata?: GenerateContentResponse["usageMetadata"];
};

async function callModel(
  model: string,
  prompt: string,
  config: { temperature: number; maxOutputTokens: number },
  onEvent?: GenContext["onEvent"]
): Promise<ModelResult> {
  if (!onEvent) {
    const r = await withRetry(() => client().models.generateContent({ model, contents: prompt, config }));
    return { text: r.text, candidates: r.candidates as ModelResult["candidates"], usageMetadata: r.usageMetadata };
  }

  onEvent({ type: "start", model, ...config });

  // Retried only up to the first chunk: "busy" arrives before anything is
  // written, and a stream that already printed text cannot be replayed.
  const stream = await withRetry(
    () =>
      client().models.generateContentStream({
        model,
        contents: prompt,
        // Thought summaries are what fills the first seconds, while the
        // model is still deciding. They are shown, never stored.
        config: { ...config, thinkingConfig: { includeThoughts: true } },
      }),
    onEvent
  );

  let text = "";
  let finishReason: string | undefined;
  let usage: ModelResult["usageMetadata"];
  for await (const chunk of stream) {
    const cand = chunk.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      if (!part.text) continue;
      if (part.thought) {
        onEvent({ type: "thought", text: part.text });
      } else {
        text += part.text;
        onEvent({ type: "text", text: part.text });
      }
    }
    if (cand?.finishReason) finishReason = cand.finishReason;
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
  }
  return { text, candidates: [{ finishReason }], usageMetadata: usage };
}

export async function generateWork(
  wing: Wing,
  school: School,
  department: DepartmentSlug,
  ctx?: GenContext
): Promise<Generation> {
  const dept = findDepartment(department);
  if (!dept) throw new Error(`Unknown department: ${department}`);
  return dept.media === "text"
    ? generateText(wing, school, department, ctx)
    : generateVisual(wing, school, department, ctx);
}

async function generateText(
  wing: Wing,
  school: School,
  department: DepartmentSlug,
  ctx?: GenContext
): Promise<Generation> {
  const chain = ctx
    ? await resolveChain(ctx.db, department, school.slug, baseVars(wing, school, department))
    : null;

  // No chain resolved means 010 has not run, or every chain in this
  // department was switched off. Fall back to the literal rather than
  // refusing to make work.
  const prompt = chain?.prompt ?? textPrompt(wing, school, department);
  const model = chain?.modelSlug ?? MODEL;

  const requestId = ctx
    ? await openRequest(ctx.db, {
        requesterId: ctx.requesterId,
        origin: ctx.origin,
        department,
        school: school.slug,
        wingId: wing.id,
        chainId: chain?.chainId ?? null,
        modelId: chain?.modelId ?? null,
        promptText: prompt,
      })
    : null;

  const started = Date.now();
  let response;
  try {
    response = await callModel(model, prompt, {
      // THE POETRY BUG. maxOutputTokens is a cap on thinking tokens AND
      // output tokens together, and it is a hard cutoff. At 400 the model
      // spent the whole budget reasoning about a poem and returned an
      // empty string, so poems silently never appeared — while one-line
      // jokes, which need almost no reasoning, usually squeaked through.
      // A poem needs room to think and then room to write.
      //
      // Both values now come from the chain when one resolved, so they
      // are tunable per department without a deploy. The literals are
      // the fallback, and they are the values the seeded chains carry.
      // High temperature on purpose: three members commissioning the
      // same school in the same gallery should not get the same work.
      temperature: chain?.temperature ?? 1.2,
      maxOutputTokens: chain?.maxOutputTokens ?? 2400,
    }, ctx?.onEvent);
  } catch (e) {
    const failed = e instanceof Error ? e.message : String(e);
    if (ctx) {
      await closeRequest(ctx.db, requestId, {
        status: "failed",
        failureReason: failed,
        durationMs: Date.now() - started,
      });
    }
    throw e;
  }

  const durationMs = Date.now() - started;
  const raw = response.text?.trim();

  if (ctx) {
    await recordResponse(ctx.db, {
      requestId,
      modelId: chain?.modelId ?? null,
      rawText: raw ?? null,
      finishReason: response.candidates?.[0]?.finishReason ?? null,
      usage: response.usageMetadata,
      durationMs,
      wasSanitised: false,
      sanitiserOk: null,
      sanitiserReason: null,
    });
  }

  if (!raw) {
    const reason = modelSilent(response);
    if (ctx) {
      await closeRequest(ctx.db, requestId, {
        status: "failed",
        failureReason: reason,
        durationMs,
      });
    }
    throw new Error(reason);
  }

  const unquoted = raw.replace(/^["'“‘]|["'”’]$/g, "").trim();
  // Line breaks are load-bearing in poetry and haiku; elsewhere they are
  // the model being chatty.
  const keepBreaks = department === "poetry" || school.slug === "haiku";

  if (ctx) {
    await closeRequest(ctx.db, requestId, { status: "succeeded", durationMs });
  }

  return {
    prompt,
    model,
    body: keepBreaks ? unquoted : unquoted.replace(/\s*\n+\s*/g, " "),
    requestId,
  };
}

async function generateVisual(
  wing: Wing,
  school: School,
  department: DepartmentSlug,
  ctx?: GenContext
): Promise<Generation> {
  const dept = findDepartment(department)!;
  const chain = ctx
    ? await resolveChain(ctx.db, department, school.slug, baseVars(wing, school, department))
    : null;

  const prompt = chain?.prompt ?? svgPrompt(wing, school, department);
  const model = chain?.modelSlug ?? MODEL;

  const requestId = ctx
    ? await openRequest(ctx.db, {
        requesterId: ctx.requesterId,
        origin: ctx.origin,
        department,
        school: school.slug,
        wingId: wing.id,
        chainId: chain?.chainId ?? null,
        modelId: chain?.modelId ?? null,
        promptText: prompt,
      })
    : null;

  const started = Date.now();
  let response;
  try {
    response = await callModel(model, prompt, {
      // Lower than text: visual composition degrades into noise at high
      // temperature in a way that prose does not. Thinking counts
      // against the token budget too, and an SVG is a long artefact.
      temperature: chain?.temperature ?? 0.95,
      maxOutputTokens: chain?.maxOutputTokens ?? 9000,
    }, ctx?.onEvent);
  } catch (e) {
    const failed = e instanceof Error ? e.message : String(e);
    if (ctx) {
      await closeRequest(ctx.db, requestId, {
        status: "failed",
        failureReason: failed,
        durationMs: Date.now() - started,
      });
    }
    throw e;
  }

  const durationMs = Date.now() - started;
  const raw = response.text?.trim();
  const finishReason = response.candidates?.[0]?.finishReason ?? null;

  if (!raw) {
    const reason = modelSilent(response);
    if (ctx) {
      await recordResponse(ctx.db, {
        requestId,
        modelId: chain?.modelId ?? null,
        rawText: null,
        finishReason,
        usage: response.usageMetadata,
        durationMs,
        wasSanitised: false,
        sanitiserOk: null,
        sanitiserReason: null,
      });
      await closeRequest(ctx.db, requestId, {
        status: "failed",
        failureReason: reason,
        durationMs,
      });
    }
    throw new Error(reason);
  }

  const title = raw.match(/^\s*TITLE:\s*(.+)$/im)?.[1]?.trim();
  const caption = raw.match(/^\s*(?:LOGLINE|PLATE):\s*(.+)$/im)?.[1]?.trim();

  const clean = sanitiseSvg(raw, dept.canvas);

  // The sanitiser verdict is recorded either way. Its rejection rate is
  // the one number that says whether the five-ink SVG constraint is
  // actually holding, and it is invisible unless the misses are stored.
  if (ctx) {
    await recordResponse(ctx.db, {
      requestId,
      modelId: chain?.modelId ?? null,
      rawText: raw,
      finishReason,
      usage: response.usageMetadata,
      durationMs,
      wasSanitised: true,
      sanitiserOk: clean.ok,
      sanitiserReason: clean.ok ? null : clean.reason,
    });
  }

  if (!clean.ok) {
    const reason =
      `The press could not pull this one (${clean.reason}). Try again — ` +
      "visual commissions fail more often than text, and a failure " +
      "doesn't count against your three.";
    if (ctx) {
      await closeRequest(ctx.db, requestId, {
        status: "failed",
        failureReason: `sanitiser: ${clean.reason}`,
        durationMs,
      });
    }
    throw new Error(reason);
  }

  if (ctx) {
    await closeRequest(ctx.db, requestId, { status: "succeeded", durationMs });
  }

  return {
    prompt,
    model,
    svgSource: clean.svg,
    title: title?.slice(0, 80) || "Untitled",
    caption: caption?.slice(0, 200),
    requestId,
  };
}

// An empty response has two very different causes and the fix differs,
// so name which one happened instead of guessing.
function modelSilent(response: { candidates?: Array<{ finishReason?: string }> }): string {
  const finish = response.candidates?.[0]?.finishReason;

  if (finish === "MAX_TOKENS") {
    return (
      "The model ran out of room before it finished writing — thinking and " +
      "output share one budget. Raise maxOutputTokens in lib/gemini.ts."
    );
  }
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
    return "The model declined this one. Try another school.";
  }
  return (
    `Model ${MODEL} returned no text${finish ? ` (${finish})` : ""}. If this ` +
    "persists, check the model name in Google AI Studio — it may have been retired."
  );
}

// ---------------------------------------------------------------
// RASTER MODE (off by default, and off for a reason)
// ---------------------------------------------------------------
// Gemini's image models have NO free tier, and video runs around
// $0.10/second — a 15-second clip is roughly $1.50 per generation. That is
// why Prints and Film generate SVG from a free text model: genuinely
// AI-generated visual media, at zero cost, in a format that also suits the
// museum's printed aesthetic.
//
// If you enable billing and want real raster images, this is the seam:
// generate with an image model, upload the bytes to Supabase Storage, and
// write only the PATH to works.image_path. Image bytes never go in a
// Postgres column. WorkDisplay already prefers image_path over svg_source.
export const RASTER_ENABLED = process.env.IMAGE_GENERATION === "on";
