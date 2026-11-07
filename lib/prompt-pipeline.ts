import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------
// THE PROMPT PIPELINE
//
// Prompts used to live as string literals in lib/gemini.ts. They live in
// the database now (migration 010), assembled from ordered rows, with a
// weighted mix deciding which variant a commission draws. The literals
// in gemini.ts remain as a fallback for exactly one reason: if this
// module cannot resolve a chain -- because 010 has not been run yet, or
// because every chain in a department was switched off by mistake -- the
// museum must still be able to make work. A configuration screen that
// can take the whole app down is a bad trade.
//
// Everything in here is best-effort. Telemetry must never be the reason
// a commission fails, so every write is wrapped and every failure
// returns null rather than throwing.
// ---------------------------------------------------------------

export type ResolvedChain = {
  chainId: number;
  modelId: number | null;
  modelSlug: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  prompt: string;
};

export type ChainVars = Record<string, string>;

type MixRow = { chain_id: number; weight: number; is_active: boolean };
type ChainRow = {
  id: number;
  slug: string;
  department: string;
  media: string;
  model_id: number | null;
  temperature: number | null;
  max_output_tokens: number | null;
  is_active: boolean;
};
type StepRow = { chain_id: number; step_order: number; template: string; is_active: boolean };

// Unknown placeholders are left in place rather than blanked. A typo in
// a template then shows up in the stored prompt, where it is obvious,
// instead of silently removing an instruction.
function substitute(template: string, vars: ChainVars): string {
  return template.replace(/\{\{([a-z0-9_.]+)\}\}/gi, (whole, key: string) =>
    key in vars ? vars[key] : whole
  );
}

// Weighted pick. Deterministic only in the degenerate single-chain case;
// otherwise the point is that two members commissioning the same school
// can draw different variants.
function pick(rows: { chain_id: number; weight: number }[]): number | null {
  const total = rows.reduce((a, r) => a + r.weight, 0);
  if (total <= 0) return null;
  let n = Math.random() * total;
  for (const r of rows) {
    n -= r.weight;
    if (n <= 0) return r.chain_id;
  }
  return rows[rows.length - 1].chain_id;
}

async function examplesBlock(
  db: Db,
  department: string,
  school: string,
  chainId: number
): Promise<string> {
  const { data } = await db
    .from("ai_generation_examples")
    .select("school, chain_id, label, example_output, polarity, sort_order")
    .eq("department", department)
    .eq("is_active", true)
    .order("sort_order");

  type Row = {
    school: string | null;
    chain_id: number | null;
    label: string;
    example_output: string;
    polarity: string;
  };

  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) =>
      (r.school === null || r.school === school) &&
      (r.chain_id === null || r.chain_id === chainId)
  );
  if (rows.length === 0) return "";

  const side = (p: string) => (p === "negative" ? "NOT LIKE THIS" : "LIKE THIS");
  return [
    "EXAMPLES",
    ...rows.map((r) => `--- ${side(r.polarity)} (${r.label}) ---\n${r.example_output}`),
  ].join("\n");
}

async function termsBlock(db: Db): Promise<string> {
  const { data } = await db
    .from("terms")
    .select("term, definition, usage_note, inject_into_prompts, is_active")
    .eq("is_active", true)
    .eq("inject_into_prompts", true)
    .order("term");

  type Row = { term: string; definition: string; usage_note: string | null };
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return "";

  return [
    "HOUSE VOCABULARY — use these words for these things:",
    ...rows.map((r) =>
      `- ${r.term}: ${r.definition}${r.usage_note ? ` ${r.usage_note}` : ""}`
    ),
  ].join("\n");
}

export async function resolveChain(
  db: Db,
  department: string,
  school: string,
  vars: ChainVars
): Promise<ResolvedChain | null> {
  try {
    const [mixRes, chainRes] = await Promise.all([
      db.from("prompt_chain_mix").select("chain_id, weight, is_active").eq("department", department),
      db
        .from("prompt_chains")
        .select("id, slug, department, media, model_id, temperature, max_output_tokens, is_active")
        .eq("department", department),
    ]);

    const chains = (chainRes.data ?? []) as unknown as ChainRow[];
    const mix = ((mixRes.data ?? []) as unknown as MixRow[]).filter(
      (m) => m.is_active && m.weight > 0 && chains.some((c) => c.id === m.chain_id && c.is_active)
    );

    const chainId = pick(mix.map((m) => ({ chain_id: m.chain_id, weight: m.weight })));
    if (chainId === null) return null;

    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return null;

    const [stepsRes, modelRes, examples, terms] = await Promise.all([
      db
        .from("prompt_chain_steps")
        .select("chain_id, step_order, template, is_active")
        .eq("chain_id", chainId)
        .order("step_order"),
      chain.model_id
        ? db.from("llm_models").select("slug, max_output_tokens, default_temperature").eq("id", chain.model_id).maybeSingle()
        : Promise.resolve({ data: null }),
      examplesBlock(db, department, school, chainId),
      termsBlock(db),
    ]);

    const steps = ((stepsRes.data ?? []) as unknown as StepRow[]).filter((s) => s.is_active);
    if (steps.length === 0) return null;

    const model = modelRes.data as
      | { slug: string; max_output_tokens: number; default_temperature: number }
      | null;

    const full: ChainVars = { ...vars, examples, terms };

    // Blank blocks would otherwise leave a stranded heading and a run of
    // empty lines in the middle of the prompt.
    const prompt = steps
      .map((s) => substitute(s.template, full).trim())
      .filter((s) => s.length > 0)
      .join("\n\n");

    return {
      chainId,
      modelId: chain.model_id,
      modelSlug: model?.slug ?? process.env.GEMINI_MODEL ?? "gemini-flash-latest",
      temperature: chain.temperature ?? model?.default_temperature ?? null,
      maxOutputTokens: chain.max_output_tokens ?? model?.max_output_tokens ?? null,
      prompt,
    };
  } catch {
    // Any failure here means the museum falls back to the literals in
    // gemini.ts. Losing the configurable pipeline is survivable; losing
    // the ability to generate is not.
    return null;
  }
}

// ---------------------------------------------------------------
// TELEMETRY
// ---------------------------------------------------------------

export type Origin = "house" | "member";

export async function openRequest(
  db: Db,
  input: {
    requesterId: string | null;
    origin: Origin;
    department: string;
    school: string;
    wingId: number;
    chainId: number | null;
    modelId: number | null;
    promptText: string;
  }
): Promise<number | null> {
  try {
    const { data, error } = await db
      .from("generation_requests")
      .insert({
        requester_id: input.requesterId,
        origin: input.origin,
        department: input.department,
        school: input.school,
        wing_id: input.wingId,
        chain_id: input.chainId,
        model_id: input.modelId,
        status: "pending",
        prompt_text: input.promptText,
      })
      .select("id")
      .single();

    if (error) return null;
    return (data as { id: number }).id;
  } catch {
    return null;
  }
}

export async function closeRequest(
  db: Db,
  requestId: number | null,
  input: {
    status: "succeeded" | "failed";
    failureReason?: string | null;
    workId?: number | null;
    durationMs: number;
  }
): Promise<void> {
  if (requestId === null) return;
  try {
    await db
      .from("generation_requests")
      .update({
        status: input.status,
        failure_reason: input.failureReason ?? null,
        work_id: input.workId ?? null,
        duration_ms: input.durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  } catch {
    /* telemetry is never the reason a commission fails */
  }
}

// The work is inserted after generation returns, so its id arrives late.
export async function attachWork(
  db: Db,
  requestId: number | null,
  workId: number
): Promise<void> {
  if (requestId === null) return;
  try {
    await db.from("generation_requests").update({ work_id: workId }).eq("id", requestId);
  } catch {
    /* ignore */
  }
}

export type Usage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export async function recordResponse(
  db: Db,
  input: {
    requestId: number | null;
    modelId: number | null;
    rawText: string | null;
    finishReason: string | null;
    usage: Usage | undefined;
    durationMs: number;
    wasSanitised: boolean;
    sanitiserOk: boolean | null;
    sanitiserReason: string | null;
  }
): Promise<void> {
  if (input.requestId === null) return;
  try {
    await db.from("llm_responses").insert({
      request_id: input.requestId,
      model_id: input.modelId,
      // Capped: the point is the shape of what came back, not an archive
      // of every generation. The work itself stores the final text.
      raw_text: input.rawText ? input.rawText.slice(0, 8000) : null,
      finish_reason: input.finishReason,
      prompt_tokens: input.usage?.promptTokenCount ?? null,
      thought_tokens: input.usage?.thoughtsTokenCount ?? null,
      output_tokens: input.usage?.candidatesTokenCount ?? null,
      total_tokens: input.usage?.totalTokenCount ?? null,
      duration_ms: input.durationMs,
      was_sanitised: input.wasSanitised,
      sanitiser_ok: input.sanitiserOk,
      sanitiser_reason: input.sanitiserReason,
    });
  } catch {
    /* ignore */
  }
}
