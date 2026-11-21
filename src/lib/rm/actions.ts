"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { enrichProject } from "@/lib/ingest/enrich";
import { parseProjectsXlsx } from "@/lib/ingest/xlsx";
import { compareModels } from "@/lib/llm/compare";
import { llmConfig } from "@/lib/llm/config";
import { analyzeProjectRisks } from "@/lib/llm/tasks/risk-events";
import { db } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string };

const fail = (error: unknown): ActionResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) });

/** Import pliku XLSX (wgranego albo dołączonego zestawu organizatora). Upsert po identyfikatorze rekordu. */
export async function importProjects(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  try {
    const file = formData.get("file");
    let buffer: ArrayBuffer;
    let name: string;
    if (file instanceof File && file.size > 0) {
      buffer = await file.arrayBuffer();
      name = file.name;
    } else {
      const bundled = await readFile(path.join(process.cwd(), "data/Risk_Miner_dane_projekty.xlsx"));
      buffer = bundled.buffer.slice(bundled.byteOffset, bundled.byteOffset + bundled.byteLength) as ArrayBuffer;
      name = "Risk_Miner_dane_projekty.xlsx (zestaw organizatora)";
    }

    const { rows, warnings } = await parseProjectsXlsx(buffer);
    const supabase = db();
    const { data: source, error: sourceError } = await supabase
      .from("rm_sources")
      .upsert({ kind: "xlsx", external_id: name, title: `Plik ${name}`, fetched_at: new Date().toISOString(), raw: { rows: rows.length, warnings } }, { onConflict: "kind,external_id" })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);

    const { error } = await supabase
      .from("rm_projects")
      .upsert(rows.map((r) => ({ ...r, source_id: source.id, updated_at: new Date().toISOString() })), { onConflict: "id" });
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    return { ok: true, message: `Zaimportowano ${rows.length} projektów.${warnings.length ? ` Uwagi: ${warnings.join(" ")}` : ""}` };
  } catch (error) {
    return fail(error);
  }
}

export async function enrichProjectAction(projectId: string): Promise<ActionResult & { notices?: number; events?: number }> {
  await requireUser();
  try {
    const result = await enrichProject(projectId);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${projectId}: postępowań ${result.procurements}, ogłoszeń ${result.notices}, zmian umowy ${result.changes}, zdarzeń z reguł ${result.events}.`,
      notices: result.notices,
      events: result.events,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function analyzeProjectAction(projectId: string): Promise<ActionResult> {
  await requireUser();
  try {
    const result = await analyzeProjectRisks(projectId);
    revalidatePath("/", "layout");
    const cost = result.cached ? "wynik z pamięci podręcznej (0 USD)" : `koszt ${result.costUsd?.toFixed(5) ?? "?"} USD`;
    return { ok: true, message: `Model ${llmConfig.model}: ${result.saved} propozycji zdarzeń do weryfikacji, ${cost}.` };
  } catch (error) {
    return fail(error);
  }
}

export async function compareModelsAction(projectId: string, models: string[]): Promise<ActionResult> {
  await requireUser();
  try {
    const allowed = models.filter((m) => /^[a-z0-9-]+\/[a-z0-9.-]+$/i.test(m)).slice(0, 8);
    if (!allowed.length) return { ok: false, message: "Wybierz co najmniej jeden model." };
    const { results, spent } = await compareModels(projectId, allowed);
    revalidatePath("/llm");
    const failed = results.filter((r) => !r.skipped && "error" in r && r.error).length;
    const skipped = results.filter((r) => r.skipped).length;
    return {
      ok: failed < results.length,
      message: `Porównanie: ${results.length} modeli, koszt ${spent.toFixed(4)} USD${failed ? `, błędy: ${failed}` : ""}${skipped ? `, pominięto ${skipped} (limit budżetu)` : ""}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

type Decision = "accept" | "reject" | "reopen";
const statusFor: Record<Decision, string> = { accept: "accepted", reject: "rejected", reopen: "proposed" };

async function logDecision(entity: string, entityId: string, action: string, before: unknown, after: unknown, comment?: string) {
  await db().from("rm_decisions").insert({ entity, entity_id: entityId, action, before, after, comment: comment || null });
}

export async function decideRiskEvent(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_risk_events").select("*").eq("id", id).single();
    const { data: after, error } = await supabase
      .from("rm_risk_events")
      .update({ status: statusFor[decision], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logDecision("risk_event", id, decision, before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "accept" ? "Zatwierdzono." : decision === "reject" ? "Odrzucono." : "Przywrócono do weryfikacji." };
  } catch (error) {
    return fail(error);
  }
}

export type RiskEventPatch = {
  risk_code: string;
  title: string;
  cause: string;
  impact: string;
  mitigation: string;
  delay_days: number | null;
  cost_pln: number | null;
};

export async function editRiskEvent(id: string, patch: RiskEventPatch, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_risk_events").select("*").eq("id", id).single();
    const { data: after, error } = await supabase
      .from("rm_risk_events")
      .update({ ...patch, status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await logDecision("risk_event", id, "edit", before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: "Zapisano poprawki i zatwierdzono." };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleExemplary(id: string, exemplary: boolean): Promise<ActionResult> {
  await requireUser();
  try {
    await db().from("rm_risk_events").update({ exemplary }).eq("id", id);
    await logDecision("risk_event", id, exemplary ? "exemplary" : "not_exemplary", null, { exemplary });
    revalidatePath("/", "layout");
    return { ok: true, message: exemplary ? "Oznaczono jako wzorcowy przykład dla modelu." : "Usunięto oznaczenie wzorcowe." };
  } catch (error) {
    return fail(error);
  }
}

export async function decideProcurement(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_procurements").select("*").eq("id", id).single();
    const { data: after, error } = await supabase.from("rm_procurements").update({ status: statusFor[decision] }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    await logDecision("procurement", id, decision, before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "accept" ? "Dopasowanie zatwierdzone." : decision === "reject" ? "Dopasowanie odrzucone." : "Przywrócono." };
  } catch (error) {
    return fail(error);
  }
}

export async function decideCatalog(code: string, approved: boolean): Promise<ActionResult> {
  await requireUser();
  try {
    await db().from("rm_risk_catalog").update({ approved, updated_at: new Date().toISOString() }).eq("code", code);
    await logDecision("catalog", code, approved ? "accept" : "reject", null, { approved });
    revalidatePath("/", "layout");
    return { ok: true, message: approved ? `Kategoria ${code} zatwierdzona.` : `Kategoria ${code} wyłączona.` };
  } catch (error) {
    return fail(error);
  }
}
