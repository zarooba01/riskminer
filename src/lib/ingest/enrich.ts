import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/supabase/admin";
import { addMonths, daysBetween, htmlToText, parseNotice, type ParsedContractChange, type ParsedNotice, type ParsedPart } from "@/lib/rm/notice-parse";
import { proposeRuleEvents } from "@/lib/rm/rules";
import type { CatalogEntry, Project } from "@/lib/rm/types";

import { normalizeNip, normalizeNoticeNumber, noticeUrl, searchNotices, type BzpNotice, type BzpQuery } from "./bzp";

export type LogEntry = { at: string; step: string; detail: string; url?: string; count?: number };

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** Podobieństwo nazw: współczynnik Dice'a na tokenach (bez słów nieznaczących). */
const stop = new Set(["w", "i", "na", "z", "do", "oraz", "wraz", "dla", "ul", "gmina", "gminy", "terenie", "miejscowości", "m", "o", "od", "po", "zadanie", "zamówienie"]);
function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !stop.has(t))
      .map((t) => t.slice(0, 6)), // prymitywny stemming dla odmiany polskiej
  );
}
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return (2 * common) / (ta.size + tb.size);
}

type Candidate = { notice: BzpNotice; method: "notice_number" | "kpo_search"; confidence: number; basis: string[] };

async function upsertSource(notice: BzpNotice, query: BzpQuery) {
  const text = htmlToText(notice.htmlBody ?? "");
  const { data, error } = await db()
    .from("rm_sources")
    .upsert(
      {
        kind: "bzp",
        external_id: notice.noticeNumber,
        title: `${notice.noticeNumber} — ${notice.orderObject}`.slice(0, 500),
        url: noticeUrl({ NoticeType: query.NoticeType, NoticeNumber: notice.noticeNumber }),
        fetched_at: new Date().toISOString(),
        content_hash: sha(notice.htmlBody ?? ""),
        raw: { ...notice, htmlBody: undefined },
        text_content: text,
      },
      { onConflict: "kind,external_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Zapis źródła: ${error.message}`);
  return { id: data.id as string, text };
}

/** Krok 1: znalezienie ogłoszenia o zamówieniu — po numerze BZP albo (dla rekordów KPO) wyszukiwaniem z oceną pewności. */
async function findContractNotices(project: Project, log: LogEntry[]): Promise<Candidate[]> {
  const nip = normalizeNip(project.beneficiary_nip);
  const province = project.province_code ? `PL${project.province_code}` : undefined;

  const number = project.public_id ? normalizeNoticeNumber(project.public_id) : null;
  let fallbackNote: string | null = null;
  if (number) {
    const query: BzpQuery = { NoticeType: "ContractNotice", NoticeNumber: number };
    const found = await searchNotices(query, 1);
    log.push({ at: new Date().toISOString(), step: "BZP: ogłoszenie po numerze", detail: number, url: noticeUrl(query), count: found.length });
    if (found.length) {
      return found.map((notice) => {
        const nipOk = nip && normalizeNip(notice.organizationNationalId) === nip;
        const basis = [`numer ogłoszenia ${number} (identyfikator z pliku)`];
        if (nipOk) basis.push(`NIP zamawiającego zgodny (${nip})`);
        else basis.push(`NIP zamawiającego RÓŻNY: plik ${project.beneficiary_nip ?? "—"}, BZP ${notice.organizationNationalId}`);
        return { notice, method: "notice_number", confidence: nipOk ? 1 : 0.6, basis };
      });
    }
    // Numer z pliku nie istnieje w BZP (błąd w danych albo publikacja tylko w TED) — próbujemy wyszukiwania.
    fallbackNote = `numer ${number} z pliku nie występuje w BZP — dopasowanie zastępcze`;
    log.push({ at: new Date().toISOString(), step: "Weryfikacja identyfikatora", detail: `${fallbackNote}; szukam po NIP i nazwie.` });
  }

  // Rekord bez numeru ogłoszenia (np. projekt KPO): szukamy ogłoszeń zamawiającego w województwie od 2023 r.
  if (!nip || !province) {
    log.push({ at: new Date().toISOString(), step: "Wyszukiwanie", detail: "Brak NIP lub województwa — nie można wyszukać ogłoszenia." });
    return [];
  }
  // KPO B3.1.1: nabory od 2023 r.; przy błędnym numerze BZP rok bierzemy z numeru (z zapasem).
  const fromYear = number ? Number(number.slice(0, 4)) - 1 : 2023;
  const query: BzpQuery = { NoticeType: "ContractNotice", OrganizationProvince: province, PublicationDateFrom: `${fromYear}-01-01T00:00:00` };
  const all = await searchNotices(query, 10);
  const own = all.filter((n) => normalizeNip(n.organizationNationalId) === nip);
  log.push({
    at: new Date().toISOString(),
    step: "BZP: wyszukiwanie po regionie, filtr NIP",
    detail: `${all.length} ogłoszeń w ${province}, ${own.length} z NIP ${nip}`,
    url: noticeUrl(query),
    count: own.length,
  });

  const reference = `${project.title} ${project.annotation ?? ""}`;
  const scored = own
    .map((notice) => {
      const sim = similarity(project.title, notice.orderObject);
      const simDesc = similarity(reference, notice.orderObject);
      const score = Math.max(sim, simDesc * 0.9);
      const basis = [`NIP zamawiającego zgodny (${nip})`, `podobieństwo nazwy ${(sim * 100).toFixed(0)}%: „${notice.orderObject.slice(0, 120)}”`];
      if (/^45/.test(notice.cpvCode ?? "")) basis.push(`CPV robót budowlanych: ${notice.cpvCode?.split(" ")[0]}`);
      if (/KPO|Krajowego Planu Odbudowy|Odbudowy/i.test(notice.htmlBody ?? "")) basis.push("ogłoszenie wspomina KPO");
      const kpoBonus = !number && basis.some((b) => b.includes("KPO")) ? 0.1 : 0;
      if (fallbackNote) basis.unshift(fallbackNote);
      return { notice, method: "kpo_search" as const, confidence: Math.min(fallbackNote ? 0.85 : 0.95, 0.35 + score * 0.6 + kpoBonus), basis };
    })
    .filter((c) => c.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence);
  // Alternatywy pokazujemy ekspertowi tylko, gdy są blisko najlepszej (niejednoznaczne dopasowanie).
  const best = scored[0]?.confidence ?? 0;
  return scored.filter((c) => c.confidence >= best - 0.12).slice(0, 3);
}

/** Krok 2: ogłoszenia powiązane (wynik, zmiany, wykonanie) — po OCID postępowania, filtrowane u nas. */
async function findRelated(contractNotice: BzpNotice, log: LogEntry[]): Promise<{ notice: BzpNotice; query: BzpQuery }[]> {
  const out: { notice: BzpNotice; query: BzpQuery }[] = [];
  for (const type of ["TenderResultNotice", "AgreementUpdateNotice", "ContractPerformingNotice"] as const) {
    const query: BzpQuery = {
      NoticeType: type,
      OrganizationProvince: contractNotice.organizationProvince,
      OrganizationCity: contractNotice.organizationCity,
      PublicationDateFrom: contractNotice.publicationDate.slice(0, 10) + "T00:00:00",
    };
    const found = (await searchNotices(query, 6)).filter((n) => n.tenderId === contractNotice.tenderId);
    log.push({ at: new Date().toISOString(), step: `BZP: ${type} po OCID`, detail: contractNotice.tenderId, url: noticeUrl(query), count: found.length });
    out.push(...found.map((notice) => ({ notice, query })));
  }
  return out;
}

type StoredNotice = { notice: BzpNotice; parsed: ParsedNotice; sourceId: string; text: string };

const near = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 1;
const sameNip = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.replace(/\D/g, "") === b.replace(/\D/g, ""));

/**
 * Krok 3: odtworzenie umów i zmian z ogłoszeń + odchylenia kosztu i czasu.
 * Zamówienie w częściach → jedna umowa na część; ogłoszenie o wykonaniu przypisujemy do części po wartości umowy albo NIP wykonawcy.
 */
async function buildContracts(procurementId: string, notices: StoredNotice[]) {
  const result = notices.find((n) => n.notice.noticeType === "TenderResultNotice");
  const performings = notices.filter((n) => n.notice.noticeType === "ContractPerformingNotice");
  const updates = notices.filter((n) => n.notice.noticeType === "AgreementUpdateNotice");
  if (!result && !performings.length && !updates.length) return [];

  type Draft = { partNo: number; part?: ParsedPart; performing?: StoredNotice; updates: StoredNotice[] };
  const drafts: Draft[] = (result?.parsed.parts ?? []).filter((p) => p.contractValue != null).map((part) => ({ partNo: part.partNo, part, updates: [] }));

  // Korekty: to samo ogłoszenie o wykonaniu opublikowane ponownie — zostaje najnowsza publikacja.
  performings.sort((x, y) => x.notice.publicationDate.localeCompare(y.notice.publicationDate));
  for (const perf of performings) {
    const republished = drafts.find(
      (d) => d.performing && near(d.performing.parsed.contractValue, perf.parsed.contractValue) && sameNip(d.performing.parsed.contractorNip, perf.parsed.contractorNip),
    );
    if (republished) {
      republished.performing = perf;
      continue;
    }
    const draft =
      drafts.find((d) => !d.performing && near(d.part?.contractValue, perf.parsed.contractValue)) ??
      drafts.find((d) => !d.performing && sameNip(d.part?.contractorNip, perf.parsed.contractorNip) && drafts.length === 1) ??
      (drafts.length === 1 && !drafts[0].performing ? drafts[0] : undefined);
    if (draft) draft.performing = perf;
    else drafts.push({ partNo: 100 + drafts.length, performing: perf, updates: [] }); // umowa bez rozpoznanej części
  }
  for (const upd of updates) {
    const draft =
      drafts.find((d) => near(d.part?.contractValue ?? d.performing?.parsed.contractValue, upd.parsed.contractValue)) ?? (drafts.length === 1 ? drafts[0] : undefined);
    if (draft) draft.updates.push(upd);
    else drafts.push({ partNo: 100 + drafts.length, updates: [upd] });
  }

  const built: { contractId: string; changesCount: number; notices: StoredNotice[] }[] = [];
  for (const d of drafts) {
    const r = d.part;
    const p = d.performing?.parsed ?? {};
    const u = d.updates[0]?.parsed ?? {};
    const signedAt = r?.signedAt ?? p.signedAt ?? u.signedAt ?? null;
    const initialValue = r?.contractValue ?? p.contractValue ?? u.contractValue ?? null;
    const months = r?.periodMonths ?? p.periodMonths ?? null;
    const plannedEnd = r?.plannedEnd ?? p.plannedEnd ?? (signedAt && months ? addMonths(signedAt, months) : null);
    const actualEnd = p.completedAt ?? null;
    const paid = p.paidTotal ?? null;
    const used = [result, d.performing, ...d.updates].filter(Boolean) as StoredNotice[];

    const contract = {
      procurement_id: procurementId,
      part_no: d.partNo,
      part_title: r?.title ?? null,
      contractor_name: r?.contractorName ?? p.contractorName ?? u.contractorName ?? null,
      contractor_nip: r?.contractorNip ?? p.contractorNip ?? null,
      signed_at: signedAt,
      initial_value: initialValue,
      initial_months: months ?? (signedAt && plannedEnd ? Math.round((daysBetween(signedAt, plannedEnd) / 30.4) * 10) / 10 : null),
      planned_end: plannedEnd,
      actual_end: actualEnd,
      on_time: p.onTime ?? null,
      paid_total: paid,
      performed_properly: p.performedProperly ?? null,
      offers_count: r?.offersCount ?? null,
      lowest_offer: r?.lowestOffer ?? null,
      highest_offer: r?.highestOffer ?? null,
      cost_deviation_pct: paid && initialValue ? Math.round(((paid - initialValue) / initialValue) * 10000) / 100 : null,
      delay_days: plannedEnd && actualEnd ? Math.max(0, daysBetween(plannedEnd, actualEnd)) : null,
      source_ids: used.map((n) => n.sourceId),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db().from("rm_contracts").upsert(contract, { onConflict: "procurement_id,part_no" }).select("id").single();
    if (error) throw new Error(`Zapis umowy: ${error.message}`);
    const contractId = data.id as string;

    const changes: { change: ParsedContractChange; sourceId: string; no: number }[] = [];
    d.performing?.parsed.changes?.forEach((change, i) => changes.push({ change, sourceId: d.performing!.sourceId, no: change.changeNo ?? i + 1 }));
    d.updates.forEach((upd) => upd.parsed.changes?.forEach((change) => changes.push({ change, sourceId: upd.sourceId, no: 1 })));
    const rows = changes.map(({ change, sourceId, no }) => ({
      contract_id: contractId,
      change_no: no,
      changed_at: change.changedAt,
      legal_basis: change.legalBasis,
      reason: change.reason,
      description: change.description,
      value_change: change.valueChange,
      price_increase: change.priceIncrease,
      source_id: sourceId,
    }));
    if (rows.length) {
      const { error: changeError } = await db().from("rm_contract_changes").upsert(rows, { onConflict: "contract_id,source_id,change_no" });
      if (changeError) throw new Error(`Zapis zmian umowy: ${changeError.message}`);
    }
    built.push({ contractId, changesCount: rows.length, notices: used });
  }
  return built;
}

export type EnrichResult = { projectId: string; procurements: number; notices: number; changes: number; events: number; log: LogEntry[] };

/** Pełne, powtarzalne wzbogacenie projektu. Można uruchamiać wielokrotnie (upserty po identyfikatorach). */
export async function enrichProject(projectId: string): Promise<EnrichResult> {
  const { data: project, error } = await db().from("rm_projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error(`Nie znaleziono projektu ${projectId}.`);

  const log: LogEntry[] = [];
  const candidates = await findContractNotices(project as Project, log);
  let noticesCount = 0;
  let changesCount = 0;
  let eventsCount = 0;

  const { data: catalog } = await db().from("rm_risk_catalog").select("*").eq("approved", true);

  for (const candidate of candidates) {
    const cn = candidate.notice;
    const { data: existing } = await db()
      .from("rm_procurements")
      .select("id,status")
      .eq("project_id", projectId)
      .eq("ocid", cn.tenderId)
      .maybeSingle();

    const { data: proc, error: procError } = await db()
      .from("rm_procurements")
      .upsert(
        {
          project_id: projectId,
          ocid: cn.tenderId,
          bzp_number: cn.bzpNumber,
          title: cn.orderObject,
          buyer_name: cn.organizationName,
          buyer_nip: cn.organizationNationalId,
          cpv: cn.cpvCode,
          match_method: candidate.method,
          match_confidence: Math.round(candidate.confidence * 100) / 100,
          match_basis: candidate.basis,
          // decyzji eksperta nie nadpisujemy; pewne dopasowanie po numerze i NIP akceptujemy automatycznie
          status: existing?.status ?? (candidate.confidence >= 1 ? "accepted" : "proposed"),
        },
        { onConflict: "project_id,ocid" },
      )
      .select("id")
      .single();
    if (procError) throw new Error(`Zapis postępowania: ${procError.message}`);

    const related = await findRelated(cn, log);
    const stored: StoredNotice[] = [];
    for (const { notice, query } of [{ notice: cn, query: { NoticeType: "ContractNotice" } as BzpQuery }, ...related]) {
      const { id: sourceId, text } = await upsertSource(notice, query);
      const parsed = parseNotice(notice.noticeType, text);
      const { error: noticeError } = await db()
        .from("rm_notices")
        .upsert(
          {
            procurement_id: proc.id,
            notice_type: notice.noticeType,
            notice_number: notice.noticeNumber,
            published_at: notice.publicationDate,
            title: notice.orderObject,
            parsed,
            source_id: sourceId,
          },
          { onConflict: "notice_number" },
        );
      if (noticeError) throw new Error(`Zapis ogłoszenia: ${noticeError.message}`);
      stored.push({ notice, parsed, sourceId, text });
    }
    noticesCount += stored.length;

    const built = await buildContracts(proc.id, stored);
    // Rekord „część N”: zdarzenia proponujemy tylko dla umowy tej części (pozostałe części zostają jako kontekst).
    const scopePart = Number((project as Project).record_scope?.match(/część\s*(\d+)/i)?.[1] ?? 0);
    const { data: partRows } = await db().from("rm_contracts").select("id,part_no").eq("procurement_id", proc.id);
    const hasScopePart = scopePart > 0 && (partRows ?? []).some((r) => r.part_no === scopePart);
    for (const contract of built) {
      const partNo = (partRows ?? []).find((r) => r.id === contract.contractId)?.part_no;
      if (hasScopePart && partNo !== scopePart) continue;
      changesCount += contract.changesCount;
      eventsCount += await proposeRuleEvents({
        projectId,
        contractId: contract.contractId,
        catalog: (catalog ?? []) as CatalogEntry[],
        notices: contract.notices.map((s) => ({ type: s.notice.noticeType, sourceId: s.sourceId, text: s.text })),
      });
    }
    if (!built.length) {
      log.push({ at: new Date().toISOString(), step: "Umowa", detail: "Brak ogłoszenia o wyniku i o wykonaniu umowy — umowy nie odtworzono (brak w źródle ≠ brak umowy)." });
    }
  }

  if (!candidates.length) log.push({ at: new Date().toISOString(), step: "Wynik", detail: "Nie znaleziono ogłoszenia — wymaga ręcznego wskazania przez eksperta." });

  await db()
    .from("rm_projects")
    .update({ enriched_at: new Date().toISOString(), enrichment_log: log, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return { projectId, procurements: candidates.length, notices: noticesCount, changes: changesCount, events: eventsCount, log };
}
