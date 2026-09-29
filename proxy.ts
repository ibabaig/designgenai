import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// This file goes at the PROJECT ROOT (next to package.json), or inside
// src/ if you use one. It runs before every matched request.
//
// Next.js 16 renamed this file to proxy.ts and the export to `proxy`.
// If you're on 16, rename both; the Supabase code inside is identical.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
