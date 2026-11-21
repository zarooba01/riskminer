import "server-only";

import { db } from "@/lib/supabase/admin";
import type { LlmRun } from "@/lib/rm/types";

import { llmConfig } from "./config";
import { runTask } from "./run";
import { buildRiskEventsSpec, quoteFound, type RiskEventsOutput } from "./tasks/risk-events";


/** Ten sam wsad na N modeli; każdy przebieg zapisany w rm_llm_runs. Nie zapisuje zdarzeń do weryfikacji. */
export async function compareModels(projectId: string, models: string[]) {
  const { spec } = await buildRiskEventsSpec(projectId);
  const results = [];
  let spent = 0;
  // sekwencyjnie, żeby pilnować budżetu (LLM_MAX_COMPARE_USD)
  for (const model of models) {
    if (spent > llmConfig.maxCompareUsd) {
      results.push({ model, skipped: true });
      continue;
    }
    const result = await runTask(spec, model);
    spent += result.costUsd ?? 0;
    results.push({ model, skipped: false, ...result });
  }
  return { results, spent };
}

export type RunMetrics = {
  run: LlmRun;
  events: number;
  codes: string[];
  quotesVerified: number;
  precision: number | null;
  recall: number | null;
};

/** Metryki przebiegów względem „złotego zbioru” = zdarzenia zatwierdzone przez eksperta dla projektu. */
export async function runMetrics(projectId: string): Promise<{ metrics: RunMetrics[]; goldCodes: string[] }> {
  const supabase = db();
  const [{ data: runs }, { data: gold }, { data: sources }] = await Promise.all([
    supabase.from("rm_llm_runs").select("*").eq("project_id", projectId).eq("task", "risk_events").order("created_at", { ascending: false }).limit(60),
    supabase.from("rm_risk_events").select("risk_code").eq("project_id", projectId).eq("status", "accepted"),
    supabase
      .from("rm_notices")
      .select("source_id, rm_procurements!inner(project_id)")
      .eq("rm_procurements.project_id", projectId),
  ]);

  const sourceIds = (sources ?? []).map((s) => s.source_id as string);
  const { data: texts } = sourceIds.length ? await supabase.from("rm_sources").select("text_content").in("id", sourceIds) : { data: [] };
  const corpus = (texts ?? []).map((t) => t.text_content ?? "").join("\n");

  const goldCodes = [...new Set((gold ?? []).map((g) => g.risk_code as string))].sort();
  const latest = new Map<string, LlmRun>();
  for (const run of (runs ?? []) as LlmRun[]) if (!latest.has(run.model)) latest.set(run.model, run);

  const metrics = [...latest.values()].map((run) => {
    const output = run.output as RiskEventsOutput | null;
    const events = output?.events ?? [];
    const codes = [...new Set(events.map((e) => e.risk_code))].sort();
    const verified = events.filter((e) => e.quote && quoteFound(corpus, e.quote)).length;
    const hit = codes.filter((c) => goldCodes.includes(c)).length;
    return {
      run,
      events: events.length,
      codes,
      quotesVerified: events.length ? verified / events.length : 0,
      precision: goldCodes.length && codes.length ? hit / codes.length : null,
      recall: goldCodes.length ? hit / goldCodes.length : null,
    };
  });
  return { metrics, goldCodes };
}
