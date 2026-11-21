import "server-only";

import { buildProjectRecords } from "@/lib/ingest/enrich";
import { db } from "@/lib/supabase/admin";

import { loadCases } from "./cases";

export const AUTO_ACCEPTED_BY = "Automatyczna akceptacja (dane demo)";

export type ReferenceBuildResult = {
  cases: number;
  events: number;
  autoMatched: { projectId: string; bzpNumber: string | null; confidence: number; contracts: number; events: number }[];
  skipped: { projectId: string; reason: string }[];
};

/**
 * Buduje bazę porównawczą (rm_ref_cases, rm_ref_events) — sklonowaną, spójną listę zakończonych projektów
 * z zaakceptowanymi zdarzeniami, na której opiera się ocena nowej inwestycji.
 *
 * Projekty bez zatwierdzonego dopasowania do BZP: najlepsza propozycja jest TYMCZASOWO zatwierdzana, żeby odtworzyć
 * umowę i zdarzenia z zapisanych ogłoszeń; po skopiowaniu do bazy porównawczej oryginał wraca do stanu sprzed operacji
 * (propozycja „do weryfikacji”, bez umów i zdarzeń, poprzedni dziennik wzbogacania i źródła dodatkowe). Decyzje eksperta
 * w oryginałach nie są zmieniane. Wszystkie dane w kopii mają oznaczenie „Automatyczna akceptacja (dane demo)”.
 */
export async function buildReferenceBase(): Promise<ReferenceBuildResult> {
  const supabase = db();
  const [{ data: projects }, { data: procs }] = await Promise.all([
    supabase.from("rm_projects").select("id,status,enriched_at,enrichment_log"),
    supabase.from("rm_procurements").select("id,project_id,status,match_confidence,bzp_number").order("match_confidence", { ascending: false }),
  ]);
  const completed = (projects ?? []).filter((p) => /zakończ|zrealizowan|wykonan/i.test(p.status ?? ""));
  const skipped: ReferenceBuildResult["skipped"] = (projects ?? []).filter((p) => !completed.includes(p)).map((p) => ({ projectId: p.id as string, reason: `status „${p.status ?? "brak"}” — nie zakończony` }));

  type Temp = { procId: string; projectId: string; bzpNumber: string | null; confidence: number; project: { enriched_at: string | null; enrichment_log: unknown }; external: Record<string, unknown>[] };
  const temp: Temp[] = [];
  for (const p of completed) {
    const own = (procs ?? []).filter((x) => x.project_id === p.id);
    if (own.some((x) => x.status === "accepted")) continue;
    const best = own.find((x) => x.status === "proposed");
    if (!best) {
      skipped.push({ projectId: p.id as string, reason: own.length ? "dopasowania odrzucone przez eksperta" : "brak dopasowania do BZP" });
      continue;
    }
    const { data: external } = await supabase.from("rm_external_checks").select("*").eq("project_id", p.id);
    temp.push({
      procId: best.id as string,
      projectId: p.id as string,
      bzpNumber: (best.bzp_number as string | null) ?? null,
      confidence: Number(best.match_confidence),
      project: { enriched_at: p.enriched_at as string | null, enrichment_log: p.enrichment_log },
      external: (external ?? []) as Record<string, unknown>[],
    });
  }

  const autoMatched: ReferenceBuildResult["autoMatched"] = [];
  let casesCount = 0;
  let eventsCount = 0;
  try {
    for (const t of temp) {
      const { error } = await supabase.from("rm_procurements").update({ status: "accepted" }).eq("id", t.procId);
      if (error) throw new Error(`Tymczasowe zatwierdzenie ${t.projectId}: ${error.message}`);
      const built = await buildProjectRecords(t.projectId);
      autoMatched.push({ projectId: t.projectId, bzpNumber: t.bzpNumber, confidence: t.confidence, contracts: built.contracts, events: built.events });
    }

    const { cases } = await loadCases();
    const autoIds = new Set(temp.map((t) => t.projectId));
    const eligible = cases.filter((c) => {
      if (!c.accepted) skipped.push({ projectId: c.project.id, reason: "brak dopasowania do BZP" });
      else if (!c.events.length) skipped.push({ projectId: c.project.id, reason: "brak zdarzeń ryzyka w źródłach" });
      return c.accepted && c.events.length > 0;
    });

    await supabase.from("rm_ref_cases").delete().not("project_id", "is", null);
    const snapshotAt = new Date().toISOString();
    if (eligible.length) {
      const { error } = await supabase.from("rm_ref_cases").insert(
        eligible.map((c) => ({
          project_id: c.project.id,
          title: c.project.title,
          beneficiary_name: c.project.beneficiary_name,
          city: c.project.city,
          province: c.project.province,
          subsector_main: c.project.subsector_main,
          subsectors_extra: c.project.subsectors_extra ?? [],
          works_type: c.project.works_type,
          project_value: c.project.project_value,
          status: c.project.status,
          value: c.value,
          paid: c.paid,
          cost_deviation_pct: c.cost_deviation_pct,
          months: c.months,
          delay_days: c.delay_days,
          offers: c.offers,
          value_changes: c.value_changes,
          term_changes: c.term_changes,
          length_m: c.length_m,
          text: c.text,
          notice_source_id: c.notice_source_id,
          bzp_number: c.procurement?.bzp_number ?? null,
          match_confidence: c.procurement?.confidence ?? null,
          match_origin: autoIds.has(c.project.id) ? "auto" : "accepted",
          accepted_by: AUTO_ACCEPTED_BY,
          snapshot_at: snapshotAt,
        })),
      );
      if (error) throw new Error(`Zapis bazy porównawczej: ${error.message}`);
      const eventRows = eligible.flatMap((c) =>
        c.events.map((e) => ({
          project_id: c.project.id,
          // Zdarzenia projektów zatwierdzanych tymczasowo zostaną w oryginale usunięte — nie trzymamy do nich odwołania.
          source_event_id: autoIds.has(c.project.id) ? null : e.id,
          risk_code: e.risk_code,
          title: e.title,
          cause: e.cause,
          impact: e.impact,
          mitigation: e.mitigation,
          quote: e.quote,
          source_id: e.source_id,
          cost_pln: e.cost_pln,
          delay_days: e.delay_days,
          quote_verified: e.quote_verified,
          origin: e.origin,
          status: "accepted",
          accepted_by: e.status === "accepted" ? "Ekspert" : AUTO_ACCEPTED_BY,
        })),
      );
      if (eventRows.length) {
        const { error: evError } = await supabase.from("rm_ref_events").insert(eventRows);
        if (evError) throw new Error(`Zapis zdarzeń bazy porównawczej: ${evError.message}`);
      }
      casesCount = eligible.length;
      eventsCount = eventRows.length;
    }
  } finally {
    // Przywrócenie oryginałów: bez umów i zdarzeń z tymczasowego zatwierdzenia, dopasowanie znów „do weryfikacji”.
    for (const t of temp) {
      await supabase.from("rm_contracts").delete().eq("procurement_id", t.procId); // kaskadowo: zmiany umów i zdarzenia
      await supabase.from("rm_risk_events").delete().eq("project_id", t.projectId).eq("status", "proposed").eq("origin", "rule");
      await supabase.from("rm_procurements").update({ status: "proposed" }).eq("id", t.procId);
      await supabase.from("rm_projects").update({ enriched_at: t.project.enriched_at, enrichment_log: t.project.enrichment_log }).eq("id", t.projectId);
      await supabase.from("rm_external_checks").delete().eq("project_id", t.projectId);
      if (t.external.length) await supabase.from("rm_external_checks").insert(t.external);
    }
  }

  await supabase.from("rm_decisions").insert({
    entity: "reference_base",
    entity_id: "all",
    action: "build",
    actor: AUTO_ACCEPTED_BY,
    after: { cases: casesCount, events: eventsCount, auto_matched: autoMatched, skipped },
    comment: "Sklonowana baza porównawcza do oceny nowych inwestycji; oryginały bez zmian.",
  });
  return { cases: casesCount, events: eventsCount, autoMatched, skipped };
}
