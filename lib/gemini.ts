import { GoogleGenAI } from "@google/genai";
import type { Wing } from "@/lib/wings";
import {
  findDepartment,
  PALETTE_FOR_PROMPT,
  type DepartmentSlug,
} from "@/lib/departments";
import { sanitiseSvg } from "@/lib/svg-sanitize";
import type { School } from "@/lib/works";

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
    `You are writing ${form} for the Museum of Digital Art.`,
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

function svgPrompt(wing: Wing, school: School, department: DepartmentSlug): string {
  const dept = findDepartment(department)!;
  const { w, h } = dept.canvas;
  const isFilm = department === "film";

  return [
    isFilm
      ? "You are composing a single film still for the Museum of Digital Art's Film department."
      : "You are composing a print for the Museum of Digital Art's Prints department.",
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
  return new GoogleGenAI({ apiKey });
}

export async function generateWork(
  wing: Wing,
  school: School,
  department: DepartmentSlug
): Promise<Generation> {
  const dept = findDepartment(department);
  if (!dept) throw new Error(`Unknown department: ${department}`);
  return dept.media === "text"
    ? generateText(wing, school, department)
    : generateVisual(wing, school, department);
}

async function generateText(
  wing: Wing,
  school: School,
  department: DepartmentSlug
): Promise<Generation> {
  const prompt = textPrompt(wing, school, department);

  const response = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    // High on purpose: three members commissioning the same school in the
    // same gallery should not get the same work.
    config: { temperature: 1.2, maxOutputTokens: 400 },
  });

  const raw = response.text?.trim();
  if (!raw) throw new Error(modelSilent());

  const unquoted = raw.replace(/^["'“‘]|["'”’]$/g, "").trim();
  // Line breaks are load-bearing in poetry and haiku; elsewhere they are
  // the model being chatty.
  const keepBreaks = department === "poetry" || school.slug === "haiku";

  return {
    prompt,
    model: MODEL,
    body: keepBreaks ? unquoted : unquoted.replace(/\s*\n+\s*/g, " "),
  };
}

async function generateVisual(
  wing: Wing,
  school: School,
  department: DepartmentSlug
): Promise<Generation> {
  const dept = findDepartment(department)!;
  const prompt = svgPrompt(wing, school, department);

  const response = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    // Lower than text. Visual composition degrades into noise at high
    // temperature in a way that prose does not.
    config: { temperature: 0.95, maxOutputTokens: 4000 },
  });

  const raw = response.text?.trim();
  if (!raw) throw new Error(modelSilent());

  const title = raw.match(/^\s*TITLE:\s*(.+)$/im)?.[1]?.trim();
  const caption = raw.match(/^\s*(?:LOGLINE|PLATE):\s*(.+)$/im)?.[1]?.trim();

  const clean = sanitiseSvg(raw, dept.canvas);
  if (!clean.ok) {
    throw new Error(
      `The press could not pull this one (${clean.reason}). Try again — ` +
        "visual commissions fail more often than text, and a failure " +
        "doesn't count against your three."
    );
  }

  return {
    prompt,
    model: MODEL,
    svgSource: clean.svg,
    title: title?.slice(0, 80) || "Untitled",
    caption: caption?.slice(0, 200),
  };
}

function modelSilent(): string {
  return (
    `Model ${MODEL} returned no text. If this persists, check the model name ` +
    "in Google AI Studio — it may have been retired."
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
