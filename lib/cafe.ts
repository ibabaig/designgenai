import { createClient } from "@/lib/supabase/server";
import { SEATS_AT_TABLES, NOTE_LIMIT } from "@/lib/cafe-constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type Drink = {
  slug: string;
  name: string;
  origin: string;
  note: string;
  vessel: "cup" | "glass" | "bowl" | "tumbler";
  ink: string;
  /** Null until you upload your own icon art and set it. */
  icon_path: string | null;
  sort_order: number;
};

export type Seat = {
  id: number;
  patron_id: string;
  sat_on: string;
  drink_slug: string;
  note: string | null;
  display_name: string;
  created_at: string;
};

// Re-exported so existing server imports from "@/lib/cafe" keep working.
// They are DEFINED in cafe-constants.ts because client components need
// them too, and this module reaches next/headers via supabase/server.
export { SEATS_AT_TABLES, NOTE_LIMIT } from "@/lib/cafe-constants";

const today = () => new Date().toISOString().slice(0, 10);

export class DrinkRepository {
  constructor(private db: DbClient) {}

  async findAll(): Promise<Drink[]> {
    const { data, error } = await this.db
      .from("drinks")
      .select("slug, name, origin, note, vessel, ink, icon_path, sort_order")
      .order("sort_order");

    if (error) throw new Error(`Could not load the menu: ${error.message}`);
    return (data ?? []) as Drink[];
  }
}

export class SeatRepository {
  constructor(private db: DbClient) {}

  // Today's room, in arrival order. The first six occupy the tables;
  // anyone after that is standing at the counter, which keeps the
  // three-table layout exact however many people turn up.
  async findToday(): Promise<Seat[]> {
    const { data, error } = await this.db
      .from("cafe_seats")
      .select("id, patron_id, sat_on, drink_slug, note, display_name, created_at")
      .eq("sat_on", today())
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Could not look into the café: ${error.message}`);
    return (data ?? []) as Seat[];
  }

  // One seat per member per day, so ordering again changes your
  // existing order rather than taking a second chair. The unique
  // constraint on (patron_id, sat_on) is what makes that safe.
  async sit(input: {
    patronId: string;
    displayName: string;
    drinkSlug: string;
    note: string | null;
  }): Promise<void> {
    const { error } = await this.db.from("cafe_seats").upsert(
      {
        patron_id: input.patronId,
        sat_on: today(),
        drink_slug: input.drinkSlug,
        note: input.note,
        display_name: input.displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patron_id,sat_on" }
    );

    if (error) {
      if (error.code === "42501") {
        throw new Error("The café is members-only, and seats are for today.");
      }
      if (error.code === "23514") {
        throw new Error(`Notes are limited to ${NOTE_LIMIT} characters.`);
      }
      throw new Error(`Could not seat you: ${error.message}`);
    }
  }

  async leave(patronId: string): Promise<void> {
    const { error } = await this.db
      .from("cafe_seats")
      .delete()
      .eq("patron_id", patronId)
      .eq("sat_on", today());

    if (error) throw new Error(`Could not clear your table: ${error.message}`);
  }
}

export type Room = {
  tables: (Seat | null)[][]; // 3 tables, 2 seats each
  counter: Seat[];
  mine: Seat | null;
  total: number;
};

// Lays today's patrons out across three tables of two, then the
// counter. Seats are filled in arrival order rather than stored as an
// index, which means no seat-assignment race when two people order at
// the same moment.
export function layOutRoom(seats: Seat[], myId: string): Room {
  const seated = seats.slice(0, SEATS_AT_TABLES);
  const counter = seats.slice(SEATS_AT_TABLES);

  const tables: (Seat | null)[][] = [
    [seated[0] ?? null, seated[1] ?? null],
    [seated[2] ?? null, seated[3] ?? null],
    [seated[4] ?? null, seated[5] ?? null],
  ];

  return {
    tables,
    counter,
    mine: seats.find((s) => s.patron_id === myId) ?? null,
    total: seats.length,
  };
}
