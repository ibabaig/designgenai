"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { takeSeat, leaveCafe } from "./actions";
import { DrinkIcon } from "./bistro";
import { NOTE_LIMIT } from "@/lib/cafe-constants";
import type { Drink, Seat } from "@/lib/cafe";

export default function OrderForm({
  drinks,
  mine,
}: {
  drinks: Drink[];
  mine: Seat | null;
}) {
  const router = useRouter();
  const [drink, setDrink] = useState(mine?.drink_slug ?? drinks[0]?.slug ?? "");
  const [note, setNote] = useState(mine?.note ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const selected = drinks.find((d) => d.slug === drink);
  const left = NOTE_LIMIT - note.length;

  function order() {
    setMessage(null);
    startTransition(async () => {
      const result = await takeSeat(drink, note);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function leave() {
    setMessage(null);
    startTransition(async () => {
      const result = await leaveCafe();
      setMessage(result.message);
      if (result.ok) {
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <section className="order-panel">
      <h2>{mine ? "Change your order" : "Order something"}</h2>
      <p>
        {mine
          ? "You already have a table today. Ordering again replaces what's on it."
          : "Pick a drink and it appears on a table. Leave a note if you like — other members can read it."}
      </p>

      <fieldset className="menu" disabled={pending}>
        <legend>The menu</legend>
        <ul className="menu-list">
          {drinks.map((d) => (
            <li key={d.slug}>
              <label className={drink === d.slug ? "is-chosen" : undefined}>
                <input
                  type="radio"
                  name="drink"
                  value={d.slug}
                  checked={drink === d.slug}
                  onChange={() => setDrink(d.slug)}
                />
                <DrinkIcon vessel={d.vessel} ink={d.ink} size={40} steam={false} />
                <span className="menu-copy">
                  <strong>{d.name}</strong>
                  <small>{d.origin}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {selected && <p className="menu-note">{selected.note}</p>}

      <label className="note-label" htmlFor="cafe-note">
        A note, if you want one <span>({left} left)</span>
      </label>
      <textarea
        id="cafe-note"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))}
        maxLength={NOTE_LIMIT}
        rows={2}
        disabled={pending}
        placeholder="What are you working on?"
      />

      <div className="order-actions">
        <button onClick={order} disabled={pending || !drink}>
          {pending ? "Putting it in…" : mine ? "Update my table" : "Take a seat"}
        </button>
        {mine && (
          <button className="order-quiet" onClick={leave} disabled={pending}>
            Clear my table
          </button>
        )}
      </div>

      {message && <p role="status">{message}</p>}
    </section>
  );
}
