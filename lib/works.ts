import { createClient } from "@/lib/supabase/server";
import type { DepartmentSlug } from "@/lib/departments";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type School = {
  slug: string;
  department: DepartmentSlug;
  name: string;
  blurb: string;
  sort_order: number;
};

/** One row of public.works — a joke, a poem, a print or a film still. */
export type Work = {
  id: number;
  wing_id: number;
  author_id: string;
  department: DepartmentSlug;
  school: string;
  prompt: string;
  model: string;
  title: string | null;
  body: string | null;
  svg_source: string | null;
  caption: string | null;
  image_path: string | null;
  score: number;
  vote_count: number;
  hung_on: string;
  accessioned_at: string | null;
  credit_name: string | null;
  created_at: string;
};

// supabase-js parses the select list at the TYPE level, and this one is
// long enough to exceed the parser's recursion depth — so rows come back
// as GenericStringError and every result needs `as unknown as Work`.
// That is why the casts below are doubled; it is not sloppiness. The
// clean fix is generated database types (`supabase gen types`), which
// this project does not have yet.
const WORK_COLUMNS =
  "id, wing_id, author_id, department, school, prompt, model, title, body, svg_source, caption, image_path, score, vote_count, hung_on, accessioned_at, credit_name, created_at";

const today = () => new Date().toISOString().slice(0, 10);

/** Museums give every object an accession number. */
export function accessionNumber(work: Work): string {
  const year = new Date(work.created_at).getFullYear();
  return `${year}.${String(work.id).padStart(4, "0")}`;
}

export class SchoolRepository {
  constructor(private db: DbClient) {}

  async findAll(): Promise<School[]> {
    const { data, error } = await this.db
      .from("schools")
      .select("slug, department, name, blurb, sort_order")
      .order("department")
      .order("sort_order");
    if (error) throw new Error(`Could not load schools: ${error.message}`);
    return (data ?? []) as School[];
  }

  async findByDepartment(department: DepartmentSlug): Promise<School[]> {
    const { data, error } = await this.db
      .from("schools")
      .select("slug, department, name, blurb, sort_order")
      .eq("department", department)
      .order("sort_order");
    if (error) throw new Error(`Could not load schools: ${error.message}`);
    return (data ?? []) as School[];
  }

  async findOne(slug: string, department: DepartmentSlug): Promise<School | null> {
    const { data, error } = await this.db
      .from("schools")
      .select("slug, department, name, blurb, sort_order")
      .eq("slug", slug)
      .eq("department", department)
      .maybeSingle();
    if (error) throw new Error(`Could not load school: ${error.message}`);
    return (data as School) ?? null;
  }
}

export class WorkRepository {
  constructor(private db: DbClient) {}

  async findInDepartmentToday(department: DepartmentSlug): Promise<Work[]> {
    const { data, error } = await this.db
      .from("works")
      .select(WORK_COLUMNS)
      .eq("department", department)
      .eq("hung_on", today())
      .order("score", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Could not load the gallery: ${error.message}`);
    return (data ?? []) as Work[];
  }

  /** Counts for the department tabs, so a visitor sees where the activity is. */
  async countsToday(): Promise<Record<string, number>> {
    const { data, error } = await this.db
      .from("works")
      .select("department")
      .eq("hung_on", today());
    if (error) throw new Error(`Could not count today's works: ${error.message}`);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.department] = (counts[row.department] ?? 0) + 1;
    }
    return counts;
  }

  // The permanent collection. Works logged-out too: the anon RLS policy
  // allows accessioned works, so this exact query serves a stranger.
  async findAccessioned(department?: DepartmentSlug, limit = 80): Promise<Work[]> {
    let q = this.db
      .from("works")
      .select(WORK_COLUMNS)
      .not("accessioned_at", "is", null);
    if (department) q = q.eq("department", department);

    const { data, error } = await q
      .order("accessioned_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Could not load the collection: ${error.message}`);
    return (data ?? []) as Work[];
  }

  async findByIds(ids: number[]): Promise<Map<number, Work>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.db
      .from("works")
      .select(WORK_COLUMNS)
      .in("id", ids);
    if (error) throw new Error(`Could not load works: ${error.message}`);
    return new Map((data ?? []).map((w) => [w.id, w as Work]));
  }

  // Drives the "2 of 3 left" counter. The cap itself is enforced by the
  // RLS insert policy, per department per day. Members can read the whole
  // gallery, so this has to be scoped by author explicitly.
  async countMineToday(authorId: string, department: DepartmentSlug): Promise<number> {
    const { count, error } = await this.db
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("author_id", authorId)
      .eq("department", department)
      .eq("hung_on", today());
    if (error) throw new Error(`Could not count your commissions: ${error.message}`);
    return count ?? 0;
  }

  async create(input: {
    wingId: number;
    authorId: string;
    department: DepartmentSlug;
    school: string;
    prompt: string;
    model: string;
    title?: string;
    body?: string;
    svgSource?: string;
    caption?: string;
  }): Promise<Work> {
    const { data, error } = await this.db
      .from("works")
      .insert({
        wing_id: input.wingId,
        author_id: input.authorId,
        department: input.department,
        school: input.school,
        prompt: input.prompt, // stored so the generation is reproducible
        model: input.model,
        title: input.title ?? null,
        body: input.body ?? null,
        svg_source: input.svgSource ?? null,
        caption: input.caption ?? null,
      })
      .select(WORK_COLUMNS)
      .single();

    if (error) {
      // The daily cap and the open-wing rule both live in the RLS insert
      // policy, so tripping either surfaces as 42501.
      if (error.code === "42501") {
        throw new Error(
          "That's your three in this department today. The other three " +
            "galleries are still open to you."
        );
      }
      throw new Error(`Could not hang the work: ${error.message}`);
    }
    return data as Work;
  }

  /** RLS already limits this to your own un-accessioned rows. */
  async withdraw(workId: number): Promise<void> {
    const { error } = await this.db.from("works").delete().eq("id", workId);
    if (error) throw new Error(`Could not withdraw: ${error.message}`);
  }
}

export class VoteRepository {
  constructor(private db: DbClient) {}

  /** Only your own ballots — all the RLS select policy returns, by design. */
  async findMine(): Promise<Map<number, -1 | 1>> {
    const { data, error } = await this.db.from("votes").select("work_id, value");
    if (error) throw new Error(`Could not load your votes: ${error.message}`);
    return new Map((data ?? []).map((v) => [v.work_id, v.value as -1 | 1]));
  }

  // One ballot per member per work: changing your mind updates the row.
  // The unique constraint on (work_id, voter_id) makes that safe.
  async cast(workId: number, voterId: string, value: -1 | 1): Promise<void> {
    const { error } = await this.db
      .from("votes")
      .upsert(
        { work_id: workId, voter_id: voterId, value },
        { onConflict: "work_id,voter_id" }
      );
    if (error) {
      if (error.code === "42501") throw new Error("You can't vote on your own work.");
      throw new Error(`Could not record vote: ${error.message}`);
    }
  }

  async retract(workId: number): Promise<void> {
    const { error } = await this.db.from("votes").delete().eq("work_id", workId);
    if (error) throw new Error(`Could not withdraw vote: ${error.message}`);
  }
}
