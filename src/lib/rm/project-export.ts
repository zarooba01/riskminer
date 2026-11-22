import type { ProjectDetail } from "./queries";
import type { CatalogEntry, Source } from "./types";

const statusLabel: Record<string, string> = { proposed: "do weryfikacji", accepted: "zatwierdzone", rejected: "odrzucone" };
const originLabel: Record<string, string> = { rule: "reguła", llm: "model AI", expert: "ekspert" };
const noticeLabel: Record<string, string> = {
  ContractNotice: "Ogłoszenie o zamówieniu",
  TenderResultNotice: "Ogłoszenie o wyniku postępowania",
  AgreementUpdateNotice: "Ogłoszenie o zmianie umowy",
  ContractPerformingNotice: "Ogłoszenie o wykonaniu umowy",
};

const round = (v: number | null, digits = 2) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits);
const sourceRef = (s: Source | undefined) => (s ? { title: s.title, url: s.url, kind: s.kind, fetched_at: s.fetched_at } : null);

/**
 * Pełny rekord inwestycji do eksportu: dane z importu, dopasowanie do BZP, ogłoszenia, umowy z kosztem i terminem,
 * zmiany umów, zdarzenia ryzyka (z cytatem i źródłem), źródła dodatkowe. Te same dane co na ekranie inwestycji.
 */
export function buildProjectRecord(detail: ProjectDetail, catalog: CatalogEntry[]) {
  const { project, procurements, events, sources, externalChecks } = detail;
  const riskName = new Map(catalog.map((c) => [c.code, c.name]));
  const live = procurements.filter((p) => p.status !== "rejected");
  const contracts = live.flatMap((p) => p.contracts);
  const value = contracts.reduce((acc, c) => acc + (c.initial_value ?? 0), 0);
  const paid = contracts.reduce((acc, c) => acc + (c.paid_total ?? 0), 0);
  const hasPaid = contracts.some((c) => c.paid_total != null);
  const delays = contracts.map((c) => c.delay_days).filter((d): d is number => d != null);
  const { enrichment_log, ...fields } = project;

  return {
    format: "Risk Miner — rekord inwestycji",
    exported_at: new Date().toISOString(),
    project: fields,
    summary: {
      bzp_numbers: live.map((p) => p.bzp_number).filter(Boolean),
      match_status: live.map((p) => statusLabel[p.status] ?? p.status),
      contracts: contracts.length,
      contract_value_pln: contracts.length ? round(value) : null,
      paid_pln: hasPaid ? round(paid) : null,
      cost_deviation_pct: hasPaid && value ? round(((paid - value) / value) * 100, 1) : null,
      planned_end: contracts.map((c) => c.planned_end).filter(Boolean).sort().at(-1) ?? null,
      actual_end: contracts.map((c) => c.actual_end).filter(Boolean).sort().at(-1) ?? null,
      delay_days: delays.length ? Math.max(...delays) : null,
      contract_changes: live.reduce((acc, p) => acc + p.changes.length, 0),
      risk_events: events.length,
      risk_events_by_status: Object.fromEntries(Object.entries(statusLabel).map(([k, label]) => [label, events.filter((e) => e.status === k).length])),
    },
    procurements: procurements.map((p) => ({
      bzp_number: p.bzp_number,
      ocid: p.ocid,
      title: p.title,
      buyer_name: p.buyer_name,
      buyer_nip: p.buyer_nip,
      cpv: p.cpv,
      match: { status: statusLabel[p.status] ?? p.status, method: p.match_method, confidence: p.match_confidence, basis: p.match_basis },
      notices: p.notices.map((n) => ({ type: noticeLabel[n.notice_type] ?? n.notice_type, number: n.notice_number, published_at: n.published_at, source: sourceRef(sources[n.source_id]) })),
      contracts: p.contracts.map((c) => ({
        part_no: c.part_no,
        part_title: c.part_title,
        contractor_name: c.contractor_name,
        contractor_nip: c.contractor_nip,
        signed_at: c.signed_at,
        initial_value: c.initial_value,
        initial_months: c.initial_months,
        planned_end: c.planned_end,
        actual_end: c.actual_end,
        on_time: c.on_time,
        paid_total: c.paid_total,
        performed_properly: c.performed_properly,
        offers_count: c.offers_count,
        lowest_offer: c.lowest_offer,
        highest_offer: c.highest_offer,
        cost_deviation_pct: c.cost_deviation_pct,
        delay_days: c.delay_days,
        changes: p.changes
          .filter((ch) => ch.contract_id === c.id)
          .map((ch) => ({
            change_no: ch.change_no,
            changed_at: ch.changed_at,
            legal_basis: ch.legal_basis,
            reason: ch.reason,
            description: ch.description,
            value_change: ch.value_change,
            price_increase: ch.price_increase,
            new_end_date: ch.new_end_date,
            source: sourceRef(sources[ch.source_id]),
          })),
        sources: c.source_ids.map((sid) => sourceRef(sources[sid])).filter(Boolean),
      })),
    })),
    risk_events: events.map((e) => ({
      risk_code: e.risk_code,
      risk_name: riskName.get(e.risk_code) ?? null,
      title: e.title,
      status: statusLabel[e.status] ?? e.status,
      origin: originLabel[e.origin] ?? e.origin,
      confidence: e.confidence,
      signal: e.signal,
      cause: e.cause,
      impact: e.impact,
      mitigation: e.mitigation,
      delay_days: e.delay_days,
      cost_pln: e.cost_pln,
      quote: e.quote,
      quote_verified: e.quote_verified,
      source: e.source_id ? sourceRef(sources[e.source_id]) : null,
    })),
    external_checks: externalChecks.map((c) => ({ source: c.source === "ted" ? "TED" : "strona postępowania zamawiającego", status: c.status, url: c.url, title: c.title, confidence: c.confidence, basis: c.basis })),
    enrichment_log,
  };
}

export type ProjectRecord = ReturnType<typeof buildProjectRecord>;

const pln = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`);
const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v).replace(/\|/g, "/").replace(/\s+/g, " ").trim());
const link = (s: { title: string; url: string | null } | null) => (s ? (s.url ? `[${txt(s.title)}](${s.url})` : txt(s.title)) : "—");

/** Ten sam rekord w Markdown — do czytania bez narzędzi. */
export function projectRecordMarkdown(r: ProjectRecord): string {
  const p = r.project;
  const s = r.summary;
  const out: string[] = [
    `# ${p.id} — ${p.title}`,
    "",
    `Eksport z Risk Miner, ${r.exported_at.slice(0, 16).replace("T", " ")} UTC.`,
    "",
    "## Dane inwestycji",
    "",
    "| Pole | Wartość |",
    "|---|---|",
    `| Identyfikator | ${p.id} |`,
    `| Odbiorca | ${txt(p.beneficiary_name)} (NIP ${txt(p.beneficiary_nip)}) |`,
    `| Lokalizacja | ${txt(p.city)}, ${txt(p.province)} |`,
    `| Identyfikator publiczny | ${txt(p.public_id_type)}: ${txt(p.public_id)} |`,
    `| Zakres rekordu | ${txt(p.record_scope)} |`,
    `| Status | ${txt(p.status)} |`,
    `| Podsektor | ${txt(p.subsector_main)}${p.subsectors_extra?.length ? ` (+ ${p.subsectors_extra.join(", ")})` : ""} |`,
    `| Rodzaj robót | ${txt(p.works_type)} |`,
    `| Wartość projektu | ${pln(p.project_value)} |`,
    `| Wzbogacono | ${txt(p.enriched_at?.slice(0, 16).replace("T", " "))} |`,
    "",
    "## Podsumowanie (plan i wykonanie)",
    "",
    `- Postępowanie w BZP: ${s.bzp_numbers.join(", ") || "brak dopasowania"} (${s.match_status.join(", ") || "—"})`,
    `- Wartość umów: ${pln(s.contract_value_pln)}; wypłacono: ${pln(s.paid_pln)}; odchylenie kosztu: ${s.cost_deviation_pct == null ? "—" : `${s.cost_deviation_pct > 0 ? "+" : ""}${s.cost_deviation_pct}%`}`,
    `- Termin: pierwotny ${txt(s.planned_end)}, wykonanie ${txt(s.actual_end)}; opóźnienie: ${s.delay_days == null ? "—" : `${s.delay_days} dni`}`,
    `- Zmiany umów: ${s.contract_changes}; zdarzenia ryzyka: ${s.risk_events} (${Object.entries(s.risk_events_by_status).map(([k, v]) => `${k}: ${v}`).join(", ")})`,
    "",
  ];

  for (const pr of r.procurements) {
    out.push(`## Postępowanie ${txt(pr.bzp_number)}`, "", `${txt(pr.title)}`, "", `Zamawiający: ${txt(pr.buyer_name)} (NIP ${txt(pr.buyer_nip)}), CPV ${txt(pr.cpv)}. OCID: ${pr.ocid}.`, "");
    out.push(`Dopasowanie: **${pr.match.status}**, metoda ${pr.match.method}, pewność ${Math.round(pr.match.confidence * 100)}%. Podstawa: ${pr.match.basis.map(txt).join("; ") || "—"}.`, "");
    if (pr.notices.length) {
      out.push("### Ogłoszenia", "", "| Rodzaj | Numer | Data | Źródło |", "|---|---|---|---|");
      for (const n of pr.notices) out.push(`| ${txt(n.type)} | ${txt(n.number)} | ${txt(n.published_at?.slice(0, 10))} | ${link(n.source)} |`);
      out.push("");
    }
    for (const c of pr.contracts) {
      out.push(`### Umowa${c.part_no > 0 && c.part_no < 100 ? ` — część ${c.part_no}` : ""}: ${txt(c.contractor_name)}`, "");
      out.push(
        "| Pole | Wartość |",
        "|---|---|",
        `| Wykonawca | ${txt(c.contractor_name)} (NIP ${txt(c.contractor_nip)}) |`,
        `| Podpisana | ${txt(c.signed_at)} |`,
        `| Wartość umowy | ${pln(c.initial_value)} |`,
        `| Wypłacono | ${pln(c.paid_total)} |`,
        `| Odchylenie kosztu | ${c.cost_deviation_pct == null ? "—" : `${c.cost_deviation_pct}%`} |`,
        `| Termin pierwotny / wykonanie | ${txt(c.planned_end)} / ${txt(c.actual_end)} |`,
        `| Opóźnienie | ${c.delay_days == null ? "—" : `${c.delay_days} dni`} |`,
        `| Oferty | ${txt(c.offers_count)} (najniższa ${pln(c.lowest_offer)}, najwyższa ${pln(c.highest_offer)}) |`,
        "",
      );
      if (c.changes.length) {
        out.push("#### Zmiany umowy", "", "| Nr | Data | Podstawa | Zmiana wartości | Nowy termin | Przyczyna | Źródło |", "|---|---|---|---|---|---|---|");
        for (const ch of c.changes) out.push(`| ${txt(ch.change_no)} | ${txt(ch.changed_at)} | ${txt(ch.legal_basis)} | ${pln(ch.value_change)} | ${txt(ch.new_end_date)} | ${txt(ch.reason ?? ch.description)} | ${link(ch.source)} |`);
        out.push("");
      }
    }
  }

  out.push("## Zdarzenia ryzyka", "");
  if (!r.risk_events.length) out.push("Brak zdarzeń ryzyka.", "");
  r.risk_events.forEach((e, i) => {
    out.push(`### ${i + 1}. ${e.risk_code} ${txt(e.risk_name)} — ${txt(e.title)}`, "");
    out.push(`Status: **${e.status}** · pochodzenie: ${e.origin}${e.confidence != null ? ` · pewność ${Math.round(e.confidence * 100)}%` : ""}`, "");
    for (const [label, v] of [
      ["Sygnał", e.signal],
      ["Przyczyna", e.cause],
      ["Wpływ", e.impact],
      ["Działanie zaradcze", e.mitigation],
    ] as const)
      if (v) out.push(`- **${label}:** ${txt(v)}`);
    out.push(`- **Skutek:** czas ${e.delay_days == null ? "—" : `${e.delay_days} dni`}, koszt ${pln(e.cost_pln)}`);
    if (e.quote) out.push(`- **Cytat ze źródła**${e.quote_verified === false ? " (nie znaleziono dosłownie w źródle)" : ""}: „${txt(e.quote)}”`);
    out.push(`- **Źródło:** ${link(e.source)}`, "");
  });

  if (r.external_checks.length) {
    out.push("## Źródła dodatkowe", "", "| Źródło | Wynik | Pewność | Podstawa |", "|---|---|---|---|");
    for (const c of r.external_checks) out.push(`| ${c.url ? `[${c.source}](${c.url})` : c.source} | ${c.status} | ${c.confidence == null ? "—" : `${Math.round(c.confidence * 100)}%`} | ${c.basis.map(txt).join("; ")} |`);
    out.push("");
  }
  return out.join("\n");
}
