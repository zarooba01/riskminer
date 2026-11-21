import "server-only";

import { createHash } from "node:crypto";

import { generateText, Output } from "ai";
import { toJSONSchema, type z } from "zod";

import { db } from "@/lib/supabase/admin";

import { estimateCost } from "./pricing";

export type TaskSpec<S extends z.ZodType> = {
  task: string;
  promptVersion: string;
  system: string;
  prompt: string;
  schema: S;
  projectId?: string;
};

const common = { reasoning: "none", temperature: 0, maxRetries: 1, providerOptions: { gateway: { caching: "auto" } } } as const;

/** Pierwszy obiekt JSON z odpowiedzi tekstowej (także w bloku ```json). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model nie zwrócił obiektu JSON.");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Wywołanie z wynikiem zgodnym ze schematem. Najpierw natywny tryb strukturalny (Output.object); gdy model go nie
 * obsługuje (np. część modeli z darmowego progu AI Gateway), tryb zapasowy: prośba o czysty JSON według schematu
 * i walidacja zod po naszej stronie. Wynik jest w obu przypadkach tak samo sprawdzony.
 */
async function generateStructured<S extends z.ZodType>(spec: TaskSpec<S>, model: string) {
  try {
    const result = await generateText({ model, system: spec.system, prompt: spec.prompt, output: Output.object({ schema: spec.schema }), ...common });
    return { result, parsed: result.output as z.infer<S> };
  } catch (structuredError) {
    const schema = JSON.stringify(toJSONSchema(spec.schema));
    const result = await generateText({
      model,
      system: `${spec.system}\n\nOdpowiedz WYŁĄCZNIE jednym obiektem JSON zgodnym z tym schematem JSON (bez komentarzy i tekstu poza JSON):\n${schema}`,
      prompt: spec.prompt,
      ...common,
    });
    const check = spec.schema.safeParse(extractJson(result.text));
    if (!check.success) {
      const first = structuredError instanceof Error ? structuredError.message.slice(0, 200) : "";
      throw new Error(`Odpowiedź modelu niezgodna ze schematem: ${check.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}${first ? ` (tryb strukturalny: ${first})` : ""}`);
    }
    return { result, parsed: check.data as z.infer<S> };
  }
}

export type RunResult<T> = { runId: string; output: T | null; cached: boolean; error: string | null; costUsd: number | null };

/**
 * Jedno wywołanie modelu z zapisem do rm_llm_runs (czas, tokeny, koszt, poprawność schematu).
 * Wynik jest cache'owany po (zadanie, model, wersja promptu, skrót wejścia) — ponowne uruchomienie nie kosztuje.
 */
export async function runTask<S extends z.ZodType>(spec: TaskSpec<S>, model: string, { force = false } = {}): Promise<RunResult<z.infer<S>>> {
  const inputHash = createHash("sha256").update(`${spec.system}\n---\n${spec.prompt}`).digest("hex");
  const supabase = db();

  if (!force) {
    const { data: hit } = await supabase
      .from("rm_llm_runs")
      .select("id,output,cost_usd")
      .match({ task: spec.task, model, prompt_version: spec.promptVersion, input_hash: inputHash, valid_schema: true })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hit) return { runId: hit.id, output: hit.output as z.infer<S>, cached: true, error: null, costUsd: 0 };
  }

  const started = Date.now();
  let row: Record<string, unknown> = { task: spec.task, model, prompt_version: spec.promptVersion, input_hash: inputHash, project_id: spec.projectId ?? null };
  let output: z.infer<S> | null = null;
  let errorMessage: string | null = null;
  let costUsd: number | null = null;

  try {
    const { result, parsed } = await generateStructured(spec, model);
    output = parsed;
    const usage = result.totalUsage;
    const noCache = usage.inputTokenDetails?.noCacheTokens ?? usage.inputTokens ?? 0;
    const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
    const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
    const gatewayCost = Number((result.providerMetadata?.gateway as Record<string, unknown> | undefined)?.cost);
    costUsd = Number.isFinite(gatewayCost) && gatewayCost > 0 ? gatewayCost : await estimateCost(model, { noCache, cacheRead, cacheWrite, output: usage.outputTokens ?? 0 });
    row = {
      ...row,
      output,
      valid_schema: true,
      tokens_in: usage.inputTokens ?? null,
      tokens_out: usage.outputTokens ?? null,
      tokens_cached: cacheRead || null,
      cost_usd: costUsd,
      cost_source: Number.isFinite(gatewayCost) && gatewayCost > 0 ? "gateway" : "pricing",
    };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 1000) : String(error);
    row = { ...row, valid_schema: false, error: errorMessage };
  }

  const { data, error } = await supabase
    .from("rm_llm_runs")
    .insert({ ...row, latency_ms: Date.now() - started })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis przebiegu LLM: ${error.message}`);
  return { runId: data.id, output, cached: false, error: errorMessage, costUsd };
}
