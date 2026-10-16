import { createClient } from "@/lib/supabase/server";
import type { DepartmentSlug } from "@/lib/departments";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Why four outcomes rather than a nullable winner: the requirement is
// to store previous days' results AND to handle days with no user
// interaction. A table that only records winners cannot distinguish
// "nobody made anything" from "the museum was closed" from "work was
// shown but nobody voted". Each of those is a different fact about the
// day, and the archive is more honest for saying which.
export type Outcome = "acquired" | "no_submissions" | "no_votes" | "no_consensus";

export type Exhibition = {
  id: number;
  held_on: string;
  department: DepartmentSlug;
  wing_id: number;
  winner_work_id: number | null;
  works_submitted: number;
  votes_cast: number;
  top_score: number | null;
  outcome: Outcome;
  closed_at: string;
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  acquired: "Acquired",
  no_submissions: "Nothing submitted",
  no_votes: "Shown, not judged",
  no_consensus: "Judged, not acquired",
};

export const OUTCOME_NOTE: Record<Outcome, string> = {
  acquired: "The membership chose a work and it entered the collection.",
  no_submissions: "The gallery stood empty. No commissions were made.",
  no_votes: "Work hung, but nobody voted. Nothing was acquired — the collection only takes work the membership actually chose.",
  no_consensus: "The membership voted and declined everything on offer.",
};

export class ExhibitionRepository {
  constructor(private db: DbClient) {}

  // Public: the `anon` policy on exhibitions allows reading the whole
  // history, the way a real museum publishes its past exhibitions.
  async findRecent(days = 30): Promise<Exhibition[]> {
    const { data, error } = await this.db
      .from("exhibitions")
      .select("*")
      .order("held_on", { ascending: false })
      .order("department", { ascending: true })
      .limit(days * 4);

    if (error) throw new Error(`Could not load the archive: ${error.message}`);
    return (data ?? []) as Exhibition[];
  }

  async findForDate(held_on: string): Promise<Exhibition[]> {
    const { data, error } = await this.db
      .from("exhibitions")
      .select("*")
      .eq("held_on", held_on)
      .order("department");

    if (error) throw new Error(`Could not load that day: ${error.message}`);
    return (data ?? []) as Exhibition[];
  }
}

export type ArchiveDay = {
  held_on: string;
  wing_id: number;
  departments: Exhibition[];
  acquiredCount: number;
  quiet: boolean; // nothing at all happened on this day
};

export function groupByDay(rows: Exhibition[]): ArchiveDay[] {
  const byDay = new Map<string, Exhibition[]>();
  for (const row of rows) {
    const list = byDay.get(row.held_on) ?? [];
    list.push(row);
    byDay.set(row.held_on, list);
  }

  return [...byDay.entries()].map(([held_on, departments]) => ({
    held_on,
    wing_id: departments[0]?.wing_id ?? 0,
    departments,
    acquiredCount: departments.filter((d) => d.outcome === "acquired").length,
    quiet: departments.every((d) => d.works_submitted === 0),
  }));
}
