import type { Metadata } from "next";

import { LlmView, type ModelMetric } from "@/components/screens/llm-view";
import { requireUser } from "@/lib/auth/session";
import { runMetrics } from "@/lib/llm/compare";
import { llmConfig, regionOf } from "@/lib/llm/config";
import { getPrices } from "@/lib/llm/pricing";
import { compareModelsAction } from "@/lib/rm/actions";
import { databaseConfigured, listProjects } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Modele" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function LlmPage({ searchParams }: PageProps<"/llm">) {
  await requireUser();
  const { project } = await searchParams;
  const projects = databaseConfigured ? (await listProjects()).filter((p) => p.procurements > 0) : [];
  const selected = typeof project === "string" ? project : (projects[0]?.id ?? null);

  const prices = await getPrices();
  const models = llmConfig.compareModels.map((id) => {
    const p = prices.get(id);
    return {
      id,
      region: regionOf(id),
      price: p ? `$${(p.input * 1e6).toFixed(2)} / $${(p.output * 1e6).toFixed(2)} za 1M tok.` : "cena nieznana",
    };
  });

  let metrics: ModelMetric[] = [];
  let goldCodes: string[] = [];
  if (selected && databaseConfigured) {
    const result = await runMetrics(selected);
    goldCodes = result.goldCodes;
    metrics = result.metrics.map((m) => ({
      model: m.run.model,
      region: regionOf(m.run.model),
      createdAt: m.run.created_at,
      validSchema: m.run.valid_schema,
      error: m.run.error,
      latencyMs: m.run.latency_ms,
      tokensIn: m.run.tokens_in,
      tokensOut: m.run.tokens_out,
      costUsd: m.run.cost_usd == null ? null : Number(m.run.cost_usd),
      costSource: m.run.cost_source,
      events: m.events,
      codes: m.codes,
      quotesVerified: m.quotesVerified,
      precision: m.precision,
      recall: m.recall,
      output: m.run.output as ModelMetric["output"],
    }));
  }

  return (
    <LlmView
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      selectedProject={selected}
      models={models}
      metrics={metrics}
      goldCodes={goldCodes}
      productionModel={llmConfig.model}
      compare={compareModelsAction}
    />
  );
}
