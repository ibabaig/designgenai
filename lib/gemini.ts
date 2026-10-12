import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Wing } from "@/lib/wings";
import { findSchool, type SchoolSlug } from "@/lib/schools";

// `gemini-flash-latest` is the stable alias that tracks the current
// Flash model, so this should not go stale. Override with GEMINI_MODEL
// to pin an exact version.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

// Who the jokes are for. Naming the audience concretely is what keeps
// the output specific instead of generically "college humour" -- an
// unspecified audience produces jokes that could be about anywhere.
const AUDIENCE =
  "The audience is a university junior in New York City: chronically online, " +
  "originally from the Midwest, still fairly new to the city, living in a dorm, " +
  "exploring the city on weekends on very little money.";

// Returned alongside the result and stored on the row. The assignment
// requires saving the prompt, and it is also the only way to reproduce
// or debug a generation after the fact.
export function buildPrompt(wing: Wing, school: SchoolSlug): string {
  const s = findSchool(school);
  if (!s) throw new Error(`Unknown school: ${school}`);

  return [
    "You are writing a short joke for a gallery in the Museum of Digital Art.",
    "The joke is the artwork. It hangs on a wall and people read it and move on.",
    "",
    `GALLERY: ${wing.name} (${wing.era_label})`,
    `SUBJECT: ${wing.subject}`,
    "",
    AUDIENCE,
    "",
    `SCHOOL: ${s.name}`,
    s.instruction,
    "",
    "A joke in this school reads like this:",
    s.example,
    "",
    "RULES",
    "- Be brief. A visitor reads this standing up.",
    "- Be specific. Name a real detail, not a category.",
    "- Plain text only. No markdown, headings, bullets, quotation marks or emoji.",
    "- Do not restate the gallery name or the subject; those are printed beside you.",
    "- Do not reuse the example. Write something new.",
    "- Keep it good-natured. Punch at situations, never at groups of people.",
    "- Output the joke only, nothing else.",
  ].join("\n");
}

export type Generation = { body: string; model: string; prompt: string };

export async function generateJoke(
  wing: Wing,
  school: SchoolSlug
): Promise<Generation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local and to Vercel's " +
        "Environment Variables. It must NOT have a NEXT_PUBLIC_ prefix."
    );
  }

  const prompt = buildPrompt(wing, school);
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      // High on purpose: three members commissioning the same school in
      // the same gallery should not get the same joke.
      temperature: 1.2,
      maxOutputTokens: 200,
    },
  });

  const raw = response.text?.trim();
  if (!raw) {
    throw new Error(
      `Model ${MODEL} returned no text. If this persists, check the model name ` +
        "in Google AI Studio -- it may have been retired."
    );
  }

  // The model sometimes wraps output in quotes despite being told not to.
  // Haiku keeps its newlines; everything else collapses to one line.
  const unquoted = raw.replace(/^["'“‘]|["'”’]$/g, "").trim();
  const body = school === "haiku" ? unquoted : unquoted.replace(/\s*\n+\s*/g, " ");

  return { body, model: MODEL, prompt };
}
