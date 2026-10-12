import { createClient } from "@/lib/supabase/server";
import type { SchoolSlug } from "@/lib/schools";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// MODEL: one row of public.jokes -- the artwork itself
export type Joke = {
  id: number;
  wing_id: number;
  author_id: string;
  school: SchoolSlug;
  prompt: string;
  model: string;
  body: string;
  score: number;
  vote_count: number;
  hung_on: string;
  accessioned_at: string | null;
  credit_name: string | null;
  created_at: string;
};

const JOKE_COLUMNS =
  "id, wing_id, author_id, school, prompt, model, body, score, vote_count, " +
  "hung_on, accessioned_at, credit_name, created_at";

// Museums give every object an accession number. So do we -- it makes
// a joke feel like a catalogued thing rather than a feed item, and it
// gives each one a stable name to screenshot and share.
export function accessionNumber(joke: Joke): string {
  const year = new Date(joke.created_at).getFullYear();
  return `${year}.${String(joke.id).padStart(4, "0")}`;
}

export class JokeRepository {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  // Today's open call in one wing. Best first, ties to the earlier
  // submission so the order is stable between loads.
  async findInWingToday(wingId: number): Promise<Joke[]> {
    const { data, error } = await this.db
      .from("jokes")
      .select(JOKE_COLUMNS)
      .eq("wing_id", wingId)
      .eq("hung_on", new Date().toISOString().slice(0, 10))
      .order("score", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Could not load today's gallery: ${error.message}`);
    return (data ?? []) as unknown as Joke[];
  }

  // The permanent collection. Readable by logged-OUT visitors too:
  // the RLS policy for `anon` is `using (accessioned_at is not null)`,
  // so this exact query returns the archive to a stranger and nothing
  // else. No separate public endpoint, no service-role key.
  async findAccessioned(limit = 100): Promise<Joke[]> {
    const { data, error } = await this.db
      .from("jokes")
      .select(JOKE_COLUMNS)
      .not("accessioned_at", "is", null)
      .order("accessioned_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Could not load the collection: ${error.message}`);
    return (data ?? []) as unknown as Joke[];
  }

  // RLS does not filter jokes by author on read -- members see the whole
  // gallery -- so this has to be scoped explicitly. It drives the "2 of 3
  // left today" counter; the cap itself is enforced by the insert policy.
  async countMineToday(authorId: string): Promise<number> {
    const { count, error } = await this.db
      .from("jokes")
      .select("id", { count: "exact", head: true })
      .eq("author_id", authorId)
      .eq("hung_on", new Date().toISOString().slice(0, 10));

    if (error) throw new Error(`Could not count your commissions: ${error.message}`);
    return count ?? 0;
  }

  async create(input: {
    wingId: number;
    authorId: string;
    school: SchoolSlug;
    prompt: string;
    model: string;
    body: string;
  }): Promise<Joke> {
    const { data, error } = await this.db
      .from("jokes")
      .insert({
        wing_id: input.wingId,
        author_id: input.authorId,
        school: input.school,
        prompt: input.prompt, // stored so the generation is reproducible
        model: input.model,
        body: input.body,
      })
      .select(JOKE_COLUMNS)
      .single();

    if (error) {
      // The daily cap and the open-wing rule both live in the RLS
      // insert policy, so tripping either surfaces as 42501.
      if (error.code === "42501") {
        throw new Error(
          "That's your three for today. The gallery rehangs tomorrow."
        );
      }
      throw new Error(`Could not hang the joke: ${error.message}`);
    }
    return data as unknown as Joke;
  }

  // No author filter needed: the RLS delete policy already limits this
  // to your own un-accessioned rows. Passing someone else's id, or an
  // accessioned one, simply deletes nothing.
  async withdraw(jokeId: number): Promise<void> {
    const { error } = await this.db.from("jokes").delete().eq("id", jokeId);
    if (error) throw new Error(`Could not withdraw: ${error.message}`);
  }
}

export class VoteRepository {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  // Returns only the caller's own ballots -- that is all the RLS select
  // policy will ever hand back, by design.
  async findMine(): Promise<Map<number, -1 | 1>> {
    const { data, error } = await this.db.from("votes").select("joke_id, value");
    if (error) throw new Error(`Could not load your votes: ${error.message}`);
    return new Map((data ?? []).map((v) => [v.joke_id, v.value as -1 | 1]));
  }

  // One ballot per member per joke. Changing your mind updates the
  // existing row rather than adding a second, and the unique constraint
  // on (joke_id, voter_id) is what makes that safe under concurrency.
  async cast(jokeId: number, voterId: string, value: -1 | 1): Promise<void> {
    const { error } = await this.db
      .from("votes")
      .upsert(
        { joke_id: jokeId, voter_id: voterId, value },
        { onConflict: "joke_id,voter_id" }
      );

    if (error) {
      if (error.code === "42501") {
        throw new Error("You can't vote on your own work.");
      }
      throw new Error(`Could not record vote: ${error.message}`);
    }
  }

  async retract(jokeId: number): Promise<void> {
    const { error } = await this.db.from("votes").delete().eq("joke_id", jokeId);
    if (error) throw new Error(`Could not withdraw vote: ${error.message}`);
  }
}
