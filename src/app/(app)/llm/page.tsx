import type { Metadata } from "next";

import { LlmView, type ModelInfo } from "@/components/screens/llm-view";
import { requireUser } from "@/lib/auth/session";
import { llmConfig, regionOf } from "@/lib/llm/config";
import { getPrices } from "@/lib/llm/pricing";
import { databaseConfigured, getLlmUsage } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Modele" };
export const dynamic = "force-dynamic";

export default async function LlmPage() {
  await requireUser();
  const [prices, usage] = await Promise.all([getPrices(), databaseConfigured ? getLlmUsage() : Promise.resolve([])]);
  const used = new Map(usage.map((u) => [u.model, u]));
  // Model produkcyjny, modele z konfiguracji i każdy model, który faktycznie był wywołany.
  const ids = [...new Set([llmConfig.model, ...llmConfig.compareModels, ...used.keys()])];

  const models: ModelInfo[] = ids.map((id) => {
    const p = prices.get(id);
    const u = used.get(id);
    return {
      id,
      region: regionOf(id),
      price: p ? `$${(p.input * 1e6).toFixed(2)} / $${(p.output * 1e6).toFixed(2)}` : "cena nieznana",
      production: id === llmConfig.model,
      calls: u?.calls ?? 0,
      tokensIn: u?.tokensIn ?? 0,
      tokensOut: u?.tokensOut ?? 0,
      costUsd: u?.costUsd ?? 0,
      lastUsedAt: u?.lastUsedAt ?? null,
    };
  });
  // Produkcyjny na górze, dalej wg kosztu i liczby wywołań.
  models.sort((a, b) => Number(b.production) - Number(a.production) || b.costUsd - a.costUsd || b.calls - a.calls);

  return <LlmView models={models} productionModel={llmConfig.model} />;
}
