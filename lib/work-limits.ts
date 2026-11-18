// How long a member may make a text work when they reword it.
//
// The database is the real cap (public.work_body_limit in migration 012);
// these numbers mirror it so the editor can count down before a save is
// ever attempted. Change both together.
//
// Humour is a tweet's length on purpose: a visitor reads it standing up.
// Poetry gets room for fourteen long free-verse lines: the model
// regularly writes 700+ characters within its 14-line rule.
export const BODY_LIMITS = {
  humour: 280,
  poetry: 900,
} as const;

export type EditableDepartment = keyof typeof BODY_LIMITS;

export function isEditableDepartment(slug: string): slug is EditableDepartment {
  return slug in BODY_LIMITS;
}

// Counts what Postgres counts. char_length() counts code points, so an
// emoji is one character here as well; String.length would say two.
export function countChars(s: string): number {
  return Array.from(s).length;
}
