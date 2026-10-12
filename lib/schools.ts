// The six comedic schools. In art history a "school" is a group of
// artists working in a shared manner -- which is exactly what these
// are. Kept in code so the prompt text is reviewable in a diff; the DB
// enforces the slug list with a CHECK constraint so the two cannot
// drift apart.
//
// Design note: six schools on one shared subject is the entire point.
// Everyone in the gallery today is working from the same prompt, so a
// vote measures the writing rather than the luck of the subject.

export const SCHOOLS = [
  {
    slug: "deadpan",
    name: "The Deadpan School",
    era: "Flat Affect",
    blurb: "Says it straight. Never signals the joke.",
    instruction:
      "Write with completely flat affect. State the absurd thing as plain fact " +
      "and stop. No exclamation marks, no 'lol', no winking, no explaining. " +
      "The humour lives in what you refuse to acknowledge. Two sentences at most.",
    example: "There are eleven showers on my floor. I have a favourite. I will not be discussing it.",
  },
  {
    slug: "absurdist",
    name: "The Absurdists",
    era: "Escalation",
    blurb: "One impossible premise, followed all the way down.",
    instruction:
      "Start from one surreal premise and commit to it with total internal logic. " +
      "Escalate once, then stop at the funniest point. Never explain the premise " +
      "or wink at the reader. Keep it under 30 words.",
    example:
      "My shower has two settings: scalding, and a temperature I can only describe as being looked at by a stranger.",
  },
  {
    slug: "observational",
    name: "The Observationalists",
    era: "Recognition",
    blurb: "Notices the specific true thing nobody says out loud.",
    instruction:
      "Name one small, specific, true detail that anyone who has been there will " +
      "recognise instantly. The funny comes from precision, not exaggeration. No " +
      "'am I the only one who', no 'why is it that'. Just the observation, under 35 words.",
    example:
      "Nobody tells you dorm bathrooms have a shift schedule, that you will learn it, and that you will never discuss it with the people you learned it from.",
  },
  {
    slug: "confessional",
    name: "The Confessional School",
    era: "Self-Portraiture",
    blurb: "Admits slightly too much.",
    instruction:
      "Confess something small and faintly humiliating in the first person, with " +
      "no self-pity and no punchline signalling. Be specific about the detail that " +
      "makes it worse. Under 30 words.",
    example:
      "I've worn shower shoes for six weeks and still don't feel clean. I think the shoes know something.",
  },
  {
    slug: "overshare",
    name: "The Overshare Movement",
    era: "Chronically Online",
    blurb: "Posts like it's 2am. Lowercase. Unhinged but articulate.",
    instruction:
      "Write as a very online person posting in real time. Lowercase throughout, " +
      "present tense, fragments allowed. Escalate across two or three short beats, " +
      "ending somewhere stranger than you started. No hashtags, no emoji, no " +
      "'literally me'. Under 40 words.",
    example:
      "update: made eye contact with my RA at 7:40am while holding a shower caddy. we both pretended it didn't happen. the caddy saw everything. the caddy remembers.",
  },
  {
    slug: "haiku",
    name: "The Haiku Room",
    era: "Formal Constraint",
    blurb: "Three lines. 5-7-5. No exceptions.",
    instruction:
      "Respond with exactly one haiku: three lines of 5, 7 and 5 syllables, " +
      "separated by newlines. Count the syllables carefully. No title, no " +
      "commentary, no explanation. The humour should be dry and arrive on the " +
      "third line.",
    example: "Steam on the mirror\nsomeone's conditioner, mine\nI do not say so",
  },
] as const;

export type SchoolSlug = (typeof SCHOOLS)[number]["slug"];

export const SCHOOL_SLUGS = SCHOOLS.map((s) => s.slug) as readonly SchoolSlug[];

export function findSchool(slug: string) {
  return SCHOOLS.find((s) => s.slug === slug);
}

export function isSchoolSlug(slug: string): slug is SchoolSlug {
  return SCHOOL_SLUGS.includes(slug as SchoolSlug);
}
