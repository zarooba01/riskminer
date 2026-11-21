import "server-only";

import { summarizeContracts } from "@/lib/rm/contracts";
import type { CatalogEntry, Contract, ContractChange, Project, RiskEvent } from "@/lib/rm/types";
import { db } from "@/lib/supabase/admin";

import { extractLengthM } from "./params";

export type CaseEvent = Pick<RiskEvent, "id" | "project_id" | "risk_code" | "title" | "cause" | "impact" | "mitigation" | "quote" | "source_id" | "status" | "origin" | "cost_pln" | "delay_days" | "quote_verified">;

/** Zakończona inwestycja z bazy jako przypadek porównawczy: cechy, liczby z umów, tekst opisu i zdarzenia. */
export type CaseRecord = {
  project: Pick<Project, "id" | "title" | "beneficiary_name" | "city" | "province" | "subsector_main" | "subsectors_extra" | "works_type" | "project_value" | "status">;
  /** Czy projekt ma zatwierdzone przez eksperta dopasowanie do postępowania w BZP (warunek użycia jego liczb). */
  accepted: boolean;
  value: number | null;
  paid: number | null;
  cost_deviation_pct: number | null;
  months: number | null;
  delay_days: number | null;
  offers: number | null;
  value_changes: number;
  term_changes: number;
  length_m: number | null;
  text: string;
  /** Ogłoszenie o zamówieniu (źródło opisu przedmiotu zamówienia). */
  notice_source_id: string | null;
  /** Najlepsze zatwierdzone dopasowanie do postępowania w BZP. */
  procurement: { bzp_number: string | null; confidence: number } | null;
  events: CaseEvent[];
};

const none = ["00000000-0000-0000-0000-000000000000"];

/** Fragment ogłoszenia o zamówieniu z opisem przedmiotu (ten sam wycinek, który trafia do analizy ryzyk). */
function briefDescription(text: string): string {
  const i = text.search(/Krótki opis przedmiotu zamówienia/i);
  return i >= 0 ? text.slice(i, i + 3500) : text.slice(0, 2000);
}

export async function loadCases(): Promise<{ cases: CaseRecord[]; catalog: CatalogEntry[] }> {
  const supabase = db();
  const [{ data: projects }, { data: procs }, { data: catalog }] = await Promise.all([
    supabase.from("rm_projects").select("id,title,beneficiary_name,city,province,subsector_main,subsectors_extra,works_type,project_value,status,annotation,record_scope"),
    supabase.from("rm_procurements").select("id,project_id,status,bzp_number,match_confidence").eq("status", "accepted").order("match_confidence", { ascending: false }),
    supabase.from("rm_risk_catalog").select("*").order("code"),
  ]);
  const completed = ((projects ?? []) as (Project & { annotation: string | null })[]).filter((p) => /zakończ|zrealizowan|wykonan/i.test(p.status ?? ""));
  const procIds = (procs ?? []).map((p) => p.id as string);

  const [{ data: contracts }, { data: notices }, { data: events }] = await Promise.all([
    supabase.from("rm_contracts").select("*").in("procurement_id", procIds.length ? procIds : none),
    supabase.from("rm_notices").select("procurement_id,source_id").eq("notice_type", "ContractNotice").in("procurement_id", procIds.length ? procIds : none),
    supabase
      .from("rm_risk_events")
      .select("id,project_id,risk_code,title,cause,impact,mitigation,quote,source_id,status,origin,cost_pln,delay_days,quote_verified")
      .in("project_id", completed.length ? completed.map((p) => p.id) : ["-"])
      .neq("status", "rejected"),
  ]);
  const contractIds = (contracts ?? []).map((c) => c.id as string);
  const [{ data: changes }, { data: sources }] = await Promise.all([
    supabase.from("rm_contract_changes").select("contract_id,value_change,new_end_date,reason,description").in("contract_id", contractIds.length ? contractIds : none),
    supabase.from("rm_sources").select("id,text_content").in("id", (notices ?? []).map((n) => n.source_id as string).concat(none)),
  ]);
  const textBySource = new Map((sources ?? []).map((s) => [s.id as string, (s.text_content as string | null) ?? ""]));

  const cases = completed.map((p): CaseRecord => {
    const ownProcs = (procs ?? []).filter((x) => x.project_id === p.id).map((x) => x.id as string);
    const ownContracts = ((contracts ?? []) as Contract[]).filter((c) => ownProcs.includes(c.procurement_id));
    const summary = summarizeContracts(p, ownContracts);
    const ownIds = new Set(ownContracts.map((c) => c.id));
    const ownChanges = ((changes ?? []) as ContractChange[]).filter((c) => ownIds.has(c.contract_id));
    const notice = (notices ?? []).find((n) => ownProcs.includes(n.procurement_id as string));
    const noticeText = notice ? briefDescription(textBySource.get(notice.source_id as string) ?? "") : "";
    const months = ownContracts.map((c) => Number(c.initial_months)).filter((m) => Number.isFinite(m) && m > 0);
    const offers = ownContracts.map((c) => c.offers_count).filter((o): o is number => o != null);
    const text = `${p.title}\n${p.annotation ?? ""}\n${noticeText}`;
    return {
      project: p,
      accepted: ownProcs.length > 0,
      value: summary?.initial_value ?? null,
      paid: summary?.paid_total ?? null,
      cost_deviation_pct: summary?.cost_deviation_pct ?? null,
      months: months.length ? Math.max(...months) : null,
      delay_days: summary?.delay_days ?? null,
      offers: offers.length ? Math.min(...offers) : null,
      value_changes: ownChanges.filter((c) => c.value_change).length,
      term_changes: ownChanges.filter((c) => c.new_end_date || /termin|harmonogram|wydłuż|przedłuż/i.test(`${c.reason ?? ""} ${c.description ?? ""}`)).length,
      length_m: extractLengthM(`${p.title} ${noticeText}`),
      text,
      notice_source_id: (notice?.source_id as string | undefined) ?? null,
      procurement: (() => {
        const best = (procs ?? []).find((x) => x.project_id === p.id);
        return best ? { bzp_number: (best.bzp_number as string | null) ?? null, confidence: Number(best.match_confidence) } : null;
      })(),
      events: ((events ?? []) as CaseEvent[]).filter((e) => e.project_id === p.id),
    };
  });
  return { cases, catalog: (catalog ?? []) as CatalogEntry[] };
}

/**
 * Przypadki do oceny nowej inwestycji: wyłącznie baza porównawcza (sklonowane, zakończone projekty z zaakceptowanymi
 * zdarzeniami). Gdy baza porównawcza jest pusta — zakończone projekty z bazy roboczej, które mają zatwierdzone zdarzenia.
 */
export async function loadComparisonCases(): Promise<{ cases: CaseRecord[]; catalog: CatalogEntry[]; source: "reference" | "live" }> {
  const supabase = db();
  const [{ data: refCases }, { data: refEvents }, { data: catalog }] = await Promise.all([
    supabase.from("rm_ref_cases").select("*").order("project_id"),
    supabase.from("rm_ref_events").select("*"),
    supabase.from("rm_risk_catalog").select("*").order("code"),
  ]);
  if (refCases?.length) {
    const cases = refCases.map(
      (r): CaseRecord => ({
        project: {
          id: r.project_id,
          title: r.title,
          beneficiary_name: r.beneficiary_name ?? "",
          city: r.city,
          province: r.province,
          subsector_main: r.subsector_main,
          subsectors_extra: r.subsectors_extra ?? [],
          works_type: r.works_type,
          project_value: r.project_value == null ? null : Number(r.project_value),
          status: r.status,
        },
        accepted: true,
        value: r.value == null ? null : Number(r.value),
        paid: r.paid == null ? null : Number(r.paid),
        cost_deviation_pct: r.cost_deviation_pct == null ? null : Number(r.cost_deviation_pct),
        months: r.months == null ? null : Number(r.months),
        delay_days: r.delay_days,
        offers: r.offers,
        value_changes: r.value_changes,
        term_changes: r.term_changes,
        length_m: r.length_m == null ? null : Number(r.length_m),
        text: r.text,
        notice_source_id: r.notice_source_id,
        procurement: { bzp_number: r.bzp_number, confidence: Number(r.match_confidence ?? 1) },
        events: (refEvents ?? [])
          .filter((e) => e.project_id === r.project_id)
          .map((e) => ({ id: e.id, project_id: e.project_id, risk_code: e.risk_code, title: e.title, cause: e.cause, impact: e.impact, mitigation: e.mitigation, quote: e.quote, source_id: e.source_id, status: "accepted", origin: e.origin, cost_pln: e.cost_pln == null ? null : Number(e.cost_pln), delay_days: e.delay_days, quote_verified: e.quote_verified })),
      }),
    );
    return { cases, catalog: (catalog ?? []) as CatalogEntry[], source: "reference" };
  }
  const live = await loadCases();
  return { ...live, cases: live.cases.filter((c) => c.events.some((e) => e.status === "accepted")), source: "live" };
}
