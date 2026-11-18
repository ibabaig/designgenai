import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ProfileRepository, isComplete } from "@/lib/profiles";
import { commission } from "@/lib/commission";
import { isDepartmentSlug } from "@/lib/departments";
import type { GenEvent } from "@/lib/gemini";

// A member's commission, streamed. The commission panel reads this as
// newline-delimited JSON and draws the model writing the work, chunk by
// chunk, instead of a spinner.
//
// Same gates as the server action: getClaims() verifies the session, the
// profile must be complete, and RLS on works and generation_requests is
// the independent second check. Nothing about the work is taken from the
// client except the department and school, both validated server-side.

export const maxDuration = 120; // a visual commission can take 20s+

export type StreamEvent =
  | { type: "pad"; pad: string }
  | GenEvent
  | {
      type: "done";
      work: {
        id: number;
        department: string;
        body: string | null;
        title: string | null;
        caption: string | null;
        svgSource: string | null;
      };
    }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ message: "Sign in to commission." }, { status: 401 });

  const profile = await new ProfileRepository(supabase).findById(userId);
  if (!isComplete(profile)) {
    return Response.json({ message: "Finish your profile first." }, { status: 403 });
  }

  let department: string, school: string;
  try {
    const body = await request.json();
    department = String(body?.department ?? "");
    school = String(body?.school ?? "");
  } catch {
    return Response.json({ message: "Bad request." }, { status: 400 });
  }
  if (!isDepartmentSlug(department)) {
    return Response.json({ message: "No such department." }, { status: 400 });
  }
  const dept = department;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* the visitor navigated away; generation finishes regardless */
        }
      };

      // Safari holds back the first 1KB of a streamed response, which
      // would swallow the opening seconds of the trace.
      send({ type: "pad", pad: " ".repeat(1024) });

      try {
        const work = await commission(supabase, userId, dept, school, send);
        revalidatePath(`/gallery/${dept}`);
        revalidatePath("/gallery");
        send({
          type: "done",
          work: {
            id: work.id,
            department: work.department,
            body: work.body,
            title: work.title,
            caption: work.caption,
            svgSource: work.svg_source,
          },
        });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "The curator is unavailable." });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by a cancelled request */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
