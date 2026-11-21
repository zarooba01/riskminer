import "server-only";

import { similarity } from "@/lib/ingest/enrich";
import { db } from "@/lib/supabase/admin";

import type { ChangeReportSummary, ReportEventRef, ReportFieldChange } from "./types";

/**
 * Raport „co się zmieniło”: migawka ustaleń projektu przed i po ponownym wzbogaceniu, analizie AI albo
 * analizie nowego dokumentu. Porównujemy zdarzenia ryzyka (dodane / zmienione / usunięte), umowy (kwoty, terminy)
 * i ustalenia z dokumentów. Decyzji eksperta nic nie nadpisuje — raport pokazuje, które z nich zostały bez zmian.
 */

type SnapEvent = {
  id: string;
  origin: string;
  rule_key: string | null;
  contract_id: string | null;
  risk_code: string;
  title: string;
  status: string;
  cost_pln: number | null;
  delay_days: number | null;
  cause: string | null;
  impact: string | null;
  quote: string | null;
};
type SnapContract = { id: string; part_no: number; initial_value: number | null; paid_total: number | null; planned_end: string | null; actual_end: string | null; delay_days: number | null; cost_deviation_pct: number | null };
type SnapFinding = { id: string; kind: string; statement: string; status: string };

export type ProjectSnapshot = { events: SnapEvent[]; contracts: SnapContract[]; changes: number; findings: SnapFinding[] };

export async function snapshotProject(projectId: string): Promise<ProjectSnapshot> {
  const supabase = db();
  const { data: procs } = await supabase.from("rm_procurements").select("id").eq("project_id", projectId).eq("status", "accepted");
  const procIds = (procs ?? []).map((p) => p.id as string);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: events }, { data: contracts }, { data: findings }] = await Promise.all([
    supabase.from("rm_risk_events").select("id,origin,rule_key,contract_id,risk_code,title,status,cost_pln,delay_days,cause,impact,quote").eq("project_id", projectId),
    supabase.from("rm_contracts").select("id,part_no,initial_value,paid_total,planned_end,actual_end,delay_days,cost_deviation_pct").in("procurement_id", procIds.length ? procIds : none),
    supabase.from("rm_document_findings").select("id,kind,statement,status").eq("project_id", projectId),
  ]);
  const contractIds = (contracts ?? []).map((c) => c.id as string);
  const { count } = await supabase.from("rm_contract_changes").select("*", { count: "exact", head: true }).in("contract_id", contractIds.length ? contractIds : none);
  return { events: (events ?? []) as SnapEvent[], contracts: (contracts ?? []) as SnapContract[], changes: count ?? 0, findings: (findings ?? []) as SnapFinding[] };
}

const eventFields: [keyof SnapEvent, string][] = [
  ["title", "Tytuł"],
  ["risk_code", "Kategoria"],
  ["status", "Status"],
  ["cost_pln", "Koszt (zł)"],
  ["delay_days", "Opóźnienie (dni)"],
  ["cause", "Przyczyna"],
  ["impact", "Wpływ"],
  ["quote", "Cytat ze źródła"],
];
const contractFields: [keyof SnapContract, string][] = [
  ["initial_value", "Wartość umowy"],
  ["paid_total", "Wypłacono"],
  ["planned_end", "Pierwotny termin"],
  ["actual_end", "Wykonanie"],
  ["delay_days", "Opóźnienie (dni)"],
  ["cost_deviation_pct", "Odchylenie kosztu (%)"],
];

const same = (a: unknown, b: unknown) => (a == null && b == null) || (typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : String(a ?? "").trim() === String(b ?? "").trim());
const ref = (e: SnapEvent): ReportEventRef => ({ id: e.id, title: e.title, risk_code: e.risk_code, origin: e.origin, status: e.status });

/** Dopasowanie zdarzeń przed/po: reguły po stałym kluczu, AI po kategorii i podobieństwie tytułu, pozostałe po id. */
function pairEvents(before: SnapEvent[], after: SnapEvent[]) {
  const pairs: [SnapEvent, SnapEvent][] = [];
  const leftAfter = new Set(after);
  const unmatchedBefore: SnapEvent[] = [];
  for (const b of before) {
    let match = [...leftAfter].find((a) => a.id === b.id);
    if (!match && b.origin === "rule" && b.rule_key) match = [...leftAfter].find((a) => a.origin === "rule" && a.rule_key === b.rule_key && a.contract_id === b.contract_id);
    if (!match && b.origin !== "rule") {
      const scored = [...leftAfter]
        .filter((a) => a.origin === b.origin && a.risk_code === b.risk_code)
        .map((a) => ({ a, sim: Math.max(similarity(a.title, b.title), a.quote && b.quote && a.quote.slice(0, 80) === b.quote.slice(0, 80) ? 1 : 0) }))
        .sort((x, y) => y.sim - x.sim);
      if (scored[0] && scored[0].sim >= 0.45) match = scored[0].a;
    }
    if (match) {
      pairs.push([b, match]);
      leftAfter.delete(match);
    } else unmatchedBefore.push(b);
  }
  return { pairs, added: [...leftAfter], removed: unmatchedBefore };
}

export function diffSnapshots(before: ProjectSnapshot, after: ProjectSnapshot): ChangeReportSummary {
  const { pairs, added, removed } = pairEvents(before.events, after.events);
  const changed: { event: ReportEventRef; fields: ReportFieldChange[] }[] = [];
  let unchanged = 0;
  for (const [b, a] of pairs) {
    const fields = eventFields.filter(([k]) => !same(b[k], a[k])).map(([k, label]) => ({ field: k, label, before: (b[k] as string | number | null) ?? null, after: (a[k] as string | number | null) ?? null }));
    if (fields.length) changed.push({ event: ref(a), fields });
    else unchanged++;
  }
  const contracts: { label: string; fields: ReportFieldChange[] }[] = [];
  for (const a of after.contracts) {
    const b = before.contracts.find((c) => c.id === a.id || c.part_no === a.part_no);
    const label = a.part_no > 0 && a.part_no < 100 ? `Umowa — część ${a.part_no}` : "Umowa";
    if (!b) {
      contracts.push({ label, fields: [{ field: "contract", label: "Umowa", before: null, after: "odtworzona z ogłoszeń" }] });
      continue;
    }
    const fields = contractFields.filter(([k]) => !same(b[k], a[k])).map(([k, l]) => ({ field: k, label: l, before: (b[k] as string | number | null) ?? null, after: (a[k] as string | number | null) ?? null }));
    if (fields.length) contracts.push({ label, fields });
  }
  const newFindings = after.findings.filter((f) => !before.findings.some((b) => b.id === f.id)).map((f) => ({ id: f.id, kind: f.kind, statement: f.statement }));
  const decided = (e: SnapEvent) => e.status !== "proposed";
  return {
    added: added.map(ref),
    removed: removed.map(ref),
    changed,
    unchanged,
    contracts,
    changes: { before: before.changes, after: after.changes },
    findingsAdded: newFindings,
    decisionsKept: pairs.filter(([b, a]) => decided(b) && b.status === a.status).length,
  };
}

export const reportIsEmpty = (s: ChangeReportSummary) =>
  !s.added.length && !s.removed.length && !s.changed.length && !s.contracts.length && !s.findingsAdded.length && s.changes.before === s.changes.after;

/**
 * Uruchamia operację między dwiema migawkami i zapisuje raport. Pierwsze wzbogacenie (projekt bez danych)
 * nie tworzy raportu — nie ma z czym porównać.
 */
export async function withChangeReport<T>(projectId: string, trigger: string, run: () => Promise<T>): Promise<T> {
  const before = await snapshotProject(projectId);
  const result = await run();
  try {
    if (!before.events.length && !before.contracts.length && !before.findings.length) return result;
    const after = await snapshotProject(projectId);
    const summary = diffSnapshots(before, after);
    await db().from("rm_change_reports").insert({ project_id: projectId, trigger, summary });
  } catch {
    // Raport jest pomocniczy — jego błąd nie może cofnąć udanej analizy.
  }
  return result;
}
