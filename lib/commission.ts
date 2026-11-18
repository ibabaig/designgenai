import { WingRepository } from "@/lib/wings";
import { SchoolRepository, WorkRepository, type Work } from "@/lib/works";
import { generateWork, type GenContext } from "@/lib/gemini";
import { attachWork } from "@/lib/prompt-pipeline";
import type { DepartmentSlug } from "@/lib/departments";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

// A member's commission, start to finish. Shared by the server action and
// the streaming endpoint so there is one copy of the rules; the only
// difference between them is whether onEvent is passed.
//
// The caller has already verified the session (getClaims) and that the
// profile is complete. RLS is the second, independent gate: a forged
// request still cannot submit as another member, to a closed wing, or
// past the daily cap.
export async function commission(
  supabase: Db,
  userId: string,
  department: DepartmentSlug,
  schoolSlug: string,
  onEvent?: GenContext["onEvent"]
): Promise<Work> {
  const school = await new SchoolRepository(supabase).findOne(schoolSlug, department);
  if (!school) throw new Error("That school doesn't work in this department.");

  // The wing is read server-side, never accepted from the client.
  const wing = await new WingRepository(supabase).findCurrent();

  // Call the model first: if it fails, nothing is written and the attempt
  // does not count against the member's three. The attempt still leaves a
  // generation_requests row either way.
  const gen = await generateWork(wing, school, department, {
    db: supabase,
    requesterId: userId,
    origin: "member",
    onEvent,
  });

  const work = await new WorkRepository(supabase).create({
    wingId: wing.id,
    authorId: userId,
    department,
    school: school.slug,
    prompt: gen.prompt,
    model: gen.model,
    title: gen.title,
    body: gen.body,
    svgSource: gen.svgSource,
    caption: gen.caption,
  });

  // Best-effort: a missing link is a gap in the telemetry, not a failure.
  await attachWork(supabase, gen.requestId ?? null, work.id);
  return work;
}
