import { createClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// MODEL: the app's representation of one row in public.artworks
export type Artwork = {
  id: number;
  title: string;
  artist: string;
  artist_nationality: string;
  date_display: string;
  year: number;
  medium: string;
};

// REPOSITORY: the only place in the app that knows how artworks are stored and queried.
// The database client is passed in (dependency injection), so it can be swapped or mocked.
export class ArtworkRepository {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async findAll(): Promise<Artwork[]> {
    const { data, error } = await this.db
      .from("artworks")
      .select("id, title, artist, artist_nationality, date_display, year, medium")
      .order("year", { ascending: true });

    if (error) {
      throw new Error(`Could not load artworks: ${error.message}`);
    }

    return (data ?? []) as Artwork[];
  }
}

// Entry point for pages: builds the client, wires up the repository, returns the rows.
export async function getArtworks(): Promise<Artwork[]> {
  const repository = new ArtworkRepository(await createClient());
  return repository.findAll();
}
