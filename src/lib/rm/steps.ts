import "server-only";

import { buildProjectRecords, searchSources } from "@/lib/ingest/enrich";

import { withChangeReport } from "./change-report";

/** Wynik jednego etapu importu dla jednego projektu (komunikat do dziennika etapów w oknie importu). */
export type StepResult = {
  ok: boolean;
  projectId: string;
  message: string;
  /** Wynik do podsumowania etapu: dopasowanie (pewne / do potwierdzenia / brak) albo odtworzenie umowy. */
  outcome?: "matched" | "proposed" | "none" | "contract" | "no_contract" | "pending_match";
};

const pctText = (v: number | null) => (v == null ? null : `${v > 0 ? "+" : ""}${v.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`);
const failed = (projectId: string, error: unknown): StepResult => ({ ok: false, projectId, message: `${projectId}: ${error instanceof Error ? error.message : String(error)}` });

/** Etap „wyszukiwanie w źródłach publicznych” (BZP: dopasowanie + ogłoszenia po OCID). */
export async function runSearchStep(projectId: string): Promise<StepResult> {
  try {
    const r = await searchSources(projectId);
    if (!r.best) return { ok: true, projectId, outcome: "none", message: `${projectId}: nie znaleziono postępowania w BZP — do ręcznego wskazania` };
    const how = r.best.method === "notice_number" ? "po numerze ogłoszenia" : `wyszukiwaniem, pewność ${Math.round(r.best.confidence * 100)}%`;
    // Pewność 100% (numer + zgodny NIP) jest zatwierdzana automatycznie; reszta czeka na eksperta.
    const outcome = r.best.confidence >= 1 ? "matched" : "proposed";
    return { ok: true, projectId, outcome, message: `${projectId}: ${r.best.bzpNumber} (${how}), ogłoszeń: ${r.notices}` };
  } catch (error) {
    return failed(projectId, error);
  }
}

/** Etap „wzbogacanie” (umowy, zmiany, odchylenia, zdarzenia z reguł — bez zapytań do BZP). */
export async function runBuildStep(projectId: string): Promise<StepResult> {
  try {
    const r = await withChangeReport(projectId, "Wzbogacenie", () => buildProjectRecords(projectId));
    if (r.pendingMatch) return { ok: true, projectId, outcome: "pending_match", message: `${projectId}: czeka na potwierdzenie dopasowania` };
    if (!r.contracts) return { ok: true, projectId, outcome: "no_contract", message: `${projectId}: brak ogłoszeń o umowie — nie odtworzono umowy` };
    const deviation = [pctText(r.costDeviationPct) && `koszt ${pctText(r.costDeviationPct)}`, r.delayDays != null && `czas ${r.delayDays > 0 ? "+" : ""}${r.delayDays} dni`]
      .filter(Boolean)
      .join(", ");
    return { ok: true, projectId, outcome: "contract", message: `${projectId}: umów ${r.contracts}, zmian ${r.changes}, zdarzeń ${r.events}${deviation ? ` · ${deviation}` : ""}` };
  } catch (error) {
    return failed(projectId, error);
  }
}
