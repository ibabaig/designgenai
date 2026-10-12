import { createClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type Wing = {
  id: number;
  slug: string;
  name: string;
  era_label: string;
  blurb: string;
  subject: string;
  sort_order: number;
};

const WING_COLUMNS = "id, slug, name, era_label, blurb, subject, sort_order";

export class WingRepository {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async findAll(): Promise<Wing[]> {
    const { data, error } = await this.db
      .from("wings")
      .select(WING_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw new Error(`Could not load wings: ${error.message}`);
    return (data ?? []) as Wing[];
  }

  // Which gallery is open today. The rotation lives in a Postgres
  // function, not here, because the RLS insert policy has to agree with
  // it exactly -- if the app and the database disagreed about which
  // wing is open, every submission would be rejected.
  async findCurrent(): Promise<Wing> {
    const { data: wingId, error: rpcError } = await this.db.rpc("current_wing_id");
    if (rpcError) throw new Error(`Could not find today's wing: ${rpcError.message}`);

    const { data, error } = await this.db
      .from("wings")
      .select(WING_COLUMNS)
      .eq("id", wingId)
      .single();

    if (error) throw new Error(`Could not load today's wing: ${error.message}`);
    return data as Wing;
  }
}
