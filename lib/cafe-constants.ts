// Café constants that BOTH server and client code need.
//
// These live apart from lib/cafe.ts on purpose. That module imports
// createClient from lib/supabase/server, which imports next/headers — so
// a client component doing a value import from it would drag a
// server-only module into the browser bundle and fail the build with
// "You're importing a component that needs next/headers".
//
// Type-only imports from lib/cafe.ts are fine anywhere, because
// TypeScript erases them. Values are not. Anything a "use client" file
// needs at runtime belongs here.

/** Three tables, two chairs each. Everyone after that is at the counter. */
export const SEATS_AT_TABLES = 6;

/** Enforced again as a CHECK constraint on cafe_seats.note. */
export const NOTE_LIMIT = 100;
