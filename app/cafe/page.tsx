import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { DrinkRepository, SeatRepository, layOutRoom } from "@/lib/cafe";
import { TableSetting } from "./bistro";
import SeatedDrink from "./seated-drink";
import OrderForm from "./order-form";
import "../museum.css";
import "./cafe.css";

// Members-only, deliberately. The permanent collection is public because
// it holds curated work; the café holds free-text notes and content
// moderation is explicitly deferred, so the audience for an unmoderated
// note is the membership rather than the open internet. The RLS policy
// enforces it — anon has no grant on cafe_seats at all — and this page
// shows a sign-in invitation rather than erroring.
export default async function CafePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const profile = userId
    ? await new ProfileRepository(supabase).findById(userId)
    : null;
  const canInteract = Boolean(userId && isComplete(profile));

  const drinks = await new DrinkRepository(supabase).findAll();

  if (!canInteract) {
    return (
      <main className="museum-page cafe-page">
        <header className="museum-header">
          <p>MUSEUM OF DIGITAL ART</p>
          <h1>The Café</h1>
          <p>
            Three tables at the back of the museum. Members pick a drink,
            leave a note, and whoever is in today is on the tables.
          </p>
          <nav className="museum-nav">
            <Link href="/gallery">Today&apos;s hanging</Link>
            <Link href="/permanent">The permanent collection</Link>
          </nav>
        </header>
        <section className="museum-empty">
          <h2>Members only</h2>
          <p>
            The café is behind the membership. Notes here are read by other
            members, so the room stays closed to the open internet.
          </p>
          <p>
            <Link
              className="museum-action-link"
              href={userId ? "/onboarding" : "/login?next=/cafe"}
            >
              {userId ? "Complete your profile" : "Member sign in"}
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const seats = await new SeatRepository(supabase).findToday();
  const drinkBySlug = new Map(drinks.map((d) => [d.slug, d]));
  const room = layOutRoom(seats, userId!);

  return (
    <main className="museum-page cafe-page">
      <header className="museum-header">
        <p>MUSEUM OF DIGITAL ART</p>
        <h1>The Café</h1>
        <p>
          Three tables. Whoever is here today is here on the tables — hover or
          tap a drink to see who ordered it and what they said. The room
          clears overnight, same as the galleries.
        </p>
        <nav className="museum-nav">
          <Link href="/gallery">Today&apos;s hanging</Link>
          <Link href="/permanent">The permanent collection</Link>
          <Link href="/archive">Exhibition history</Link>
        </nav>
      </header>

      <section className="cafe-room">
        <p className="museum-kicker">
          {room.total === 0
            ? "THE TABLES HAVE BEEN WIPED DOWN"
            : `${room.total} ${room.total === 1 ? "PERSON" : "PEOPLE"} IN TODAY`}
        </p>

        <div className="cafe-tables">
          {room.tables.map((table, i) => (
            <TableSetting key={i} label={`Table ${i + 1}`}>
              {table.map((seat, j) => {
                if (!seat) return <span key={j} className="empty-seat" />;
                const d = drinkBySlug.get(seat.drink_slug);
                if (!d) return <span key={j} className="empty-seat" />;
                return (
                  <SeatedDrink
                    key={seat.id}
                    seat={seat}
                    drink={d}
                    isMine={seat.patron_id === userId}
                  />
                );
              })}
            </TableSetting>
          ))}
        </div>

        {room.total === 0 && (
          <p className="cafe-empty-note">
            Nobody has sat down yet today. Order something and you&apos;ll have
            the place to yourself for a while.
          </p>
        )}

        {room.counter.length > 0 && (
          <div className="cafe-counter">
            <h2>At the counter</h2>
            <p>The tables filled up. These members are standing.</p>
            <div className="counter-drinks">
              {room.counter.map((seat) => {
                const d = drinkBySlug.get(seat.drink_slug);
                if (!d) return null;
                return (
                  <SeatedDrink
                    key={seat.id}
                    seat={seat}
                    drink={d}
                    isMine={seat.patron_id === userId}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <OrderForm drinks={drinks} mine={room.mine} />
    </main>
  );
}
