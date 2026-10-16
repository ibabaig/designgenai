"use client";

import { useState } from "react";
import { DrinkIcon } from "./bistro";
import type { Drink, Seat } from "@/lib/cafe";

// A drink sitting on a table. Hovering reveals the patron's nametag and
// note; clicking pins it open, so the note is reachable on touch and by
// keyboard, not only by mouse.
export default function SeatedDrink({
  seat,
  drink,
  isMine,
}: {
  seat: Seat;
  drink: Drink;
  isMine: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const panelId = `seat-${seat.id}`;

  return (
    <div className={isMine ? "seated-drink is-mine" : "seated-drink"}>
      <button
        type="button"
        className="drink-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setPinned((p) => !p)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {drink.icon_path ? (
          // Your own icon art, once uploaded. Until drinks.icon_path is
          // set this never renders and the drawn fallback is used.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/drink-icons/${drink.icon_path}`}
            alt=""
            width={54}
            height={54}
          />
        ) : (
          <DrinkIcon vessel={drink.vessel} ink={drink.ink} />
        )}
        <span className="visually-hidden">
          {seat.display_name}, {drink.name}
        </span>
      </button>

      {open && (
        <div id={panelId} role="tooltip" className="nametag">
          <p className="nametag-patron">
            {seat.display_name}
            {isMine && " (you)"}
          </p>
          <p className="nametag-order">
            {drink.name} · {drink.origin}
          </p>
          {/* React escapes this, so a note cannot inject markup. Content
              moderation is deferred — see the migration's notes on
              cafe_seats. */}
          {seat.note && <p className="nametag-note">“{seat.note}”</p>}
        </div>
      )}
    </div>
  );
}
