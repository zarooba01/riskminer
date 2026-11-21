import { NextResponse } from "next/server";

import { llmConfig } from "@/lib/llm/config";
import { analyzeProjectRisks } from "@/lib/llm/tasks/risk-events";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/projects/<id>/analyze?model=dostawca/model — analiza ryzyk modelem (domyślnie LLM_MODEL). */
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/analyze">) {
  const { id } = await params;
  const model = new URL(request.url).searchParams.get("model") ?? llmConfig.model;
  try {
    const result = await analyzeProjectRisks(id, model);
    return NextResponse.json({ model, runId: result.runId, cached: result.cached, costUsd: result.costUsd, saved: result.saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
