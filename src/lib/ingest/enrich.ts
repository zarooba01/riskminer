import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/supabase/admin";
import { addMonths, daysBetween, extractNewEndDate, htmlToText, parseNotice, type ParsedContractChange, type ParsedNotice, type ParsedPart } from "@/lib/rm/notice-parse";
import { proposeRuleEvents } from "@/lib/rm/rules";
import type { CatalogEntry, Project } from "@/lib/rm/types";

import { checkExternalSources, type ExternalCheckRow } from "./external";
import { normalizeNip, normalizeNoticeNumber, noticePublicUrl, noticeUrl, searchNotices, type BzpNotice, type BzpQuery } from "./bzp";

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

/** Rdzeń nazwy zamawiającego do filtra OrganizationName: „Gmina Kartuzy – Urząd Miejski w Kartuzach” → „Kartuzy”. */
export function organizationNameKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const core = name
    .split(/\s+[–-]\s+/)[0]
    .replace(/^(gmina(\s+(miejska|wiejska|miasto))?|miasto(\s+i\s+gmina)?|miasto\s+stołeczne|urząd\s+(miejski|miasta|gminy|miasta\s+i\s+gminy)\s+w)\s+/i, "")
    .trim();
  return core.length >= 3 ? core : null;
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
        url: notice.objectId ? noticePublicUrl(notice.objectId) : noticeUrl({ NoticeType: query.NoticeType, NoticeNumber: notice.noticeNumber }),
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
  const from = `${fromYear}-01-01T00:00:00`;
  // 1) Szybko: filtr po fragmencie nazwy zamawiającego (API BZP nie filtruje po NIP) — ułamek sekundy.
  // 2) Zapasowo: pełny przegląd województwa (wolny: strony po ~18 MB), tylko gdy 1) nic nie da.
  const nameKey = organizationNameKey(project.beneficiary_name);
  let own: BzpNotice[] = [];
  if (nameKey) {
    const query: BzpQuery = { NoticeType: "ContractNotice", OrganizationProvince: province, OrganizationName: nameKey, PublicationDateFrom: from };
    const all = await searchNotices(query, 4);
    own = all.filter((n) => normalizeNip(n.organizationNationalId) === nip);
    log.push({ at: new Date().toISOString(), step: "BZP: wyszukiwanie po nazwie zamawiającego, filtr NIP", detail: `„${nameKey}” w ${province}: ${all.length} ogłoszeń, ${own.length} z NIP ${nip}`, url: noticeUrl(query), count: own.length });
  }
  if (!own.length) {
    const query: BzpQuery = { NoticeType: "ContractNotice", OrganizationProvince: province, PublicationDateFrom: from };
    const all = await searchNotices(query, 6);
    own = all.filter((n) => normalizeNip(n.organizationNationalId) === nip);
    log.push({ at: new Date().toISOString(), step: "BZP: wyszukiwanie po regionie, filtr NIP", detail: `${all.length} ogłoszeń w ${province}, ${own.length} z NIP ${nip}`, url: noticeUrl(query), count: own.length });
  }

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
  // Trzy typy ogłoszeń równolegle (kopia BZP nie ma limitu zapytań).
  const results = await Promise.all(
    (["TenderResultNotice", "AgreementUpdateNotice", "ContractPerformingNotice"] as const).map(async (type) => {
      const query: BzpQuery = {
        NoticeType: type,
        OrganizationProvince: contractNotice.organizationProvince,
        OrganizationCity: contractNotice.organizationCity,
        PublicationDateFrom: contractNotice.publicationDate.slice(0, 10) + "T00:00:00",
      };
      const found = (await searchNotices(query, 6)).filter((n) => n.tenderId === contractNotice.tenderId);
      return { type, query, found };
    }),
  );
  return results.flatMap(({ type, query, found }) => {
    log.push({ at: new Date().toISOString(), step: `BZP: ${type} po OCID`, detail: contractNotice.tenderId, url: noticeUrl(query), count: found.length });
    return found.map((notice) => ({ notice, query }));
  });
}

type StoredNotice = { notice: BzpNotice; parsed: ParsedNotice; sourceId: string; text: string };

const near = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 1;
const sameNip = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.replace(/\D/g, "") === b.replace(/\D/g, ""));

const squashText = (s: string | null | undefined) => (s ?? "").replace(/[\s"„”]+/g, " ").trim().toLowerCase();

/** Czy dwa opisy dotyczą tej samej zmiany umowy: ta sama kwota, a bez kwot — ta sama przyczyna i podobny opis. */
function sameChange(a: ParsedContractChange, b: ParsedContractChange): boolean {
  if (a.valueChange != null && b.valueChange != null) {
    if (Math.abs(a.valueChange - b.valueChange) < 1) return true;
    // Ta sama zmiana bywa podana z różną kwotą (np. korekta rozliczenia w ogłoszeniu o wykonaniu) — do 5% różnicy
    // uznajemy ją za tę samą, jeśli przyczyna jest identyczna, a opis podobny.
    const close = Math.abs(a.valueChange - b.valueChange) <= 0.05 * Math.max(Math.abs(a.valueChange), Math.abs(b.valueChange));
    return close && squashText(a.reason) === squashText(b.reason) && similarity(a.description ?? "", b.description ?? "") >= 0.5;
  }
  if ((a.valueChange == null) !== (b.valueChange == null)) return false;
  const ra = squashText(a.reason);
  return ra.length > 10 && ra === squashText(b.reason) && similarity(a.description ?? "", b.description ?? "") >= 0.3;
}

type ChangeDraft = { no: number; change: ParsedContractChange; sourceId: string; related: string[]; claimed: boolean };

/**
 * Jedna zmiana umowy = jeden rekord. Ogłoszenie o wykonaniu umowy zawiera pełną, ponumerowaną listę zmian;
 * każda z nich mogła być wcześniej opublikowana jako osobne ogłoszenie o zmianie umowy (tam zawsze bez numeru).
 * Łączymy je po kwocie (albo przyczynie i opisie). Głównym źródłem zostaje ogłoszenie o zmianie umowy — ma datę
 * zmiany i pełny opis aneksu; ogłoszenie o wykonaniu trafia do źródeł powiązanych.
 */
export function mergeChanges(performing: StoredNotice | undefined, updates: StoredNotice[]) {
  const drafts: ChangeDraft[] = (performing?.parsed.changes ?? []).map((change, i) => ({
    no: change.changeNo ?? i + 1,
    change: { ...change },
    sourceId: performing!.sourceId,
    related: [],
    claimed: false,
  }));
  const ordered = [...updates].sort((x, y) => x.notice.publicationDate.localeCompare(y.notice.publicationDate));
  for (const upd of ordered) {
    for (const change of upd.parsed.changes ?? []) {
      const match = drafts.find((d) => !d.claimed && d.sourceId !== upd.sourceId && sameChange(d.change, change));
      if (match) {
        match.claimed = true;
        match.related = [...new Set([...match.related, match.sourceId])];
        match.sourceId = upd.sourceId;
        match.change = {
          ...match.change,
          changedAt: change.changedAt ?? match.change.changedAt,
          legalBasis: change.legalBasis ?? match.change.legalBasis,
          reason: change.reason ?? match.change.reason,
          description: change.description ?? match.change.description,
          valueChange: match.change.valueChange ?? change.valueChange,
        };
      } else {
        drafts.push({ no: Math.max(0, ...drafts.map((d) => d.no)) + 1, change: { ...change }, sourceId: upd.sourceId, related: [], claimed: true });
      }
    }
  }
  return drafts.map(({ no, change, sourceId, related }) => ({ no, change, sourceId, related }));
}

/**
 * Zapis zmian umowy z zachowaniem identyfikatorów (po numerze zmiany): na identyfikatorze zmiany opierają się
 * propozycje zdarzeń i decyzje eksperta. Duplikaty z wcześniejszych wersji (ta sama zmiana z kilku ogłoszeń) usuwamy.
 */
async function saveChanges(contractId: string, rows: (Record<string, unknown> & { change_no: number })[]) {
  const { data: existing } = await db().from("rm_contract_changes").select("id,change_no").eq("contract_id", contractId).order("created_at");
  const keep = new Map<number, string>();
  const drop: string[] = [];
  for (const e of existing ?? []) {
    const no = e.change_no as number;
    if (rows.some((r) => r.change_no === no) && !keep.has(no)) keep.set(no, e.id as string);
    else drop.push(e.id as string);
  }
  if (drop.length) {
    const { error } = await db().from("rm_contract_changes").delete().in("id", drop);
    if (error) throw new Error(`Usuwanie zdublowanych zmian umowy: ${error.message}`);
  }
  for (const row of rows) {
    const id = keep.get(row.change_no);
    const { error } = id ? await db().from("rm_contract_changes").update(row).eq("id", id) : await db().from("rm_contract_changes").insert(row);
    if (error) throw new Error(`Zapis zmian umowy: ${error.message}`);
  }
}

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

    const merged = mergeChanges(d.performing, d.updates);
    const rows = merged.map(({ change, sourceId, related, no }) => ({
      contract_id: contractId,
      change_no: no,
      changed_at: change.changedAt,
      legal_basis: change.legalBasis,
      reason: change.reason,
      description: change.description,
      value_change: change.valueChange,
      price_increase: change.priceIncrease,
      new_end_date: extractNewEndDate(`${change.description ?? ""} ${change.reason ?? ""}`),
      source_id: sourceId,
      related_source_ids: related,
    }));
    await saveChanges(contractId, rows);
    built.push({ contractId, changesCount: rows.length, notices: used });
  }
  return built;
}

export type EnrichResult = { projectId: string; procurements: number; notices: number; changes: number; events: number; log: LogEntry[] };

type StoreCandidate = { notice: BzpNotice; method: string; confidence: number; basis: string[] };

/**
 * Zapis dopasowanego postępowania z wszystkimi ogłoszeniami (po OCID): rm_procurements, rm_sources, rm_notices.
 * Zwraca liczbę zapisanych ogłoszeń. `status` wymusza decyzję (np. ręczne wskazanie przez eksperta).
 */
async function storeProcurement(projectId: string, candidate: StoreCandidate, log: LogEntry[], status?: "accepted" | "proposed"): Promise<number> {
  const cn = candidate.notice;
  const { data: existing } = await db().from("rm_procurements").select("id,status").eq("project_id", projectId).eq("ocid", cn.tenderId).maybeSingle();

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
        status: status ?? existing?.status ?? (candidate.confidence >= 1 ? "accepted" : "proposed"),
      },
      { onConflict: "project_id,ocid" },
    )
    .select("id")
    .single();
  if (procError) throw new Error(`Zapis postępowania: ${procError.message}`);

  const related = await findRelated(cn, log);
  // Zapis ogłoszeń równolegle (każde: źródło + rekord ogłoszenia).
  await Promise.all(
    [{ notice: cn, query: { NoticeType: "ContractNotice" } as BzpQuery }, ...related].map(async ({ notice, query }) => {
      const { id: sourceId, text } = await upsertSource(notice, query);
      const { error: noticeError } = await db()
        .from("rm_notices")
        .upsert(
          {
            procurement_id: proc.id,
            notice_type: notice.noticeType,
            notice_number: notice.noticeNumber,
            published_at: notice.publicationDate,
            title: notice.orderObject,
            parsed: parseNotice(notice.noticeType, text),
            source_id: sourceId,
          },
          { onConflict: "procurement_id,notice_number" },
        );
      if (noticeError) throw new Error(`Zapis ogłoszenia: ${noticeError.message}`);
    }),
  );
  return related.length + 1;
}

/**
 * Ręczne wskazanie przetargu przez eksperta (modyfikacja połączenia): numer ogłoszenia o zamówieniu w BZP.
 * Dotychczasowe dopasowania projektu zostają odrzucone, wskazane jest zatwierdzane, a dane przeliczane od nowa.
 */
export async function assignProcurement(projectId: string, rawNumber: string, add = false) {
  const { data: project, error } = await db().from("rm_projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error(`Nie znaleziono projektu ${projectId}.`);
  const number = normalizeNoticeNumber(rawNumber);
  if (!number) throw new Error("Podaj numer ogłoszenia w formacie RRRR/BZP NNNNNNNN/WW, np. 2022/BZP 00058537/01.");

  const log: LogEntry[] = ((project as Project).enrichment_log ?? []) as LogEntry[];
  const query: BzpQuery = { NoticeType: "ContractNotice", NoticeNumber: number };
  const [notice] = await searchNotices(query, 1);
  log.push({ at: new Date().toISOString(), step: "Ręczne wskazanie przetargu", detail: number, url: noticeUrl(query), count: notice ? 1 : 0 });
  if (!notice) throw new Error(`W BZP nie ma ogłoszenia o zamówieniu ${number}. Podaj numer ogłoszenia o zamówieniu (nie o wyniku ani o wykonaniu umowy).`);

  const nip = normalizeNip((project as Project).beneficiary_nip);
  const nipOk = Boolean(nip && normalizeNip(notice.organizationNationalId) === nip);
  const basis = [`${add ? "dodane przez eksperta jako kolejne zamówienie inwestycji" : "wskazane ręcznie przez eksperta"}: ${number}`, nipOk ? `NIP zamawiającego zgodny (${nip})` : `NIP zamawiającego różny: projekt ${(project as Project).beneficiary_nip ?? "—"}, BZP ${notice.organizationNationalId}`];

  const { data: previous } = await db().from("rm_procurements").select("id,ocid,status").eq("project_id", projectId).neq("status", "rejected");
  // Kolejne zamówienie tej samej inwestycji (np. osobny przetarg na sieć i na oczyszczalnię) — dotychczasowe zostają.
  const toReject = add ? [] : (previous ?? []).filter((p) => p.ocid !== notice.tenderId).map((p) => p.id as string);
  if (toReject.length) await db().from("rm_procurements").update({ status: "rejected" }).in("id", toReject);

  const notices = await storeProcurement(projectId, { notice, method: "manual", confidence: nipOk ? 1 : 0.8, basis }, log, "accepted");
  await db().from("rm_projects").update({ enrichment_log: log, updated_at: new Date().toISOString() }).eq("id", projectId);
  const built = await buildProjectRecords(projectId);
  return { bzpNumber: notice.bzpNumber, title: notice.orderObject, nipOk, notices, rejected: toReject, ...built };
}

export type SearchResult = {
  projectId: string;
  procurements: number;
  notices: number;
  /** Najlepsze dopasowanie: metoda i pewność (do komunikatu dla użytkownika). */
  best: { method: string; confidence: number; bzpNumber: string } | null;
  log: LogEntry[];
};

/**
 * Faza 1 — wyszukiwanie w źródłach publicznych: dopasowanie projektu do postępowania w BZP i pobranie
 * wszystkich ogłoszeń tego postępowania (po OCID). Zapisuje rm_procurements, rm_sources, rm_notices.
 */
export async function searchSources(projectId: string): Promise<SearchResult> {
  const { data: project, error } = await db().from("rm_projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error(`Nie znaleziono projektu ${projectId}.`);

  const log: LogEntry[] = [];
  const candidates = await findContractNotices(project as Project, log);
  let noticesCount = 0;

  for (const candidate of candidates) {
    noticesCount += await storeProcurement(projectId, candidate, log);
  }

  if (!candidates.length) log.push({ at: new Date().toISOString(), step: "Wynik", detail: "Nie znaleziono ogłoszenia — wymaga ręcznego wskazania przez eksperta." });
  await db().from("rm_projects").update({ enrichment_log: log, updated_at: new Date().toISOString() }).eq("id", projectId);

  const top = candidates[0];
  return {
    projectId,
    procurements: candidates.length,
    notices: noticesCount,
    best: top ? { method: top.method, confidence: Math.round(top.confidence * 100) / 100, bzpNumber: top.notice.bzpNumber } : null,
    log,
  };
}

export type BuildResult = {
  projectId: string;
  contracts: number;
  changes: number;
  events: number;
  costDeviationPct: number | null;
  delayDays: number | null;
  /** Projekt ma tylko niepotwierdzone dopasowanie — wzbogacanie czeka na decyzję eksperta. */
  pendingMatch: boolean;
  /** Wynik sprawdzenia źródeł dodatkowych (strona postępowania, TED). */
  external: { source: string; status: string }[];
};

/** Usuwa nieocenione propozycje zdarzeń z umów postępowań, które nie są zatwierdzone (decyzje eksperta zostają). */
export async function dropUnconfirmedEvents(procurementIds: string[]) {
  if (!procurementIds.length) return;
  const { data: contracts } = await db().from("rm_contracts").select("id").in("procurement_id", procurementIds);
  const ids = (contracts ?? []).map((c) => c.id as string);
  if (ids.length) await db().from("rm_risk_events").delete().in("contract_id", ids).eq("status", "proposed");
}

/**
 * Faza 2 — wzbogacanie: z zapisanych ogłoszeń (bez ponownych zapytań do BZP) odtwarza umowy, zmiany umów,
 * odchylenia kosztu i czasu oraz proponuje zdarzenia ryzyka regułami.
 */
export async function buildProjectRecords(projectId: string): Promise<BuildResult> {
  const supabase = db();
  const { data: project, error } = await supabase.from("rm_projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error(`Nie znaleziono projektu ${projectId}.`);
  const log = ((project as Project).enrichment_log ?? []) as LogEntry[];

  const [{ data: catalog }, { data: allProcs }] = await Promise.all([
    supabase.from("rm_risk_catalog").select("*").eq("approved", true),
    supabase.from("rm_procurements").select("id,status").eq("project_id", projectId).order("match_confidence", { ascending: false }),
  ]);
  // Wzbogacamy wyłącznie zatwierdzone dopasowania (pewne 100% albo potwierdzone przez eksperta).
  // Niepotwierdzone mogą dotyczyć cudzego przetargu — nie liczymy z nich umowy, kosztu, czasu ani zdarzeń.
  const procs = (allProcs ?? []).filter((p) => p.status === "accepted");
  await dropUnconfirmedEvents((allProcs ?? []).filter((p) => p.status !== "accepted").map((p) => p.id as string));
  const pendingMatch = !procs.length && (allProcs ?? []).some((p) => p.status === "proposed");

  let contractsCount = 0;
  let changesCount = 0;
  let eventsCount = 0;
  let headline: { cost: number | null; delay: number | null } | null = null;
  const scopePart = Number((project as Project).record_scope?.match(/część\s*(\d+)/i)?.[1] ?? 0);

  for (const proc of procs) {
    const { data: rows } = await supabase.from("rm_notices").select("notice_type,parsed,source_id, rm_sources!inner(raw,text_content)").eq("procurement_id", proc.id);
    const stored: StoredNotice[] = (rows ?? []).map((r) => {
      const src = (Array.isArray(r.rm_sources) ? r.rm_sources[0] : r.rm_sources) as { raw: BzpNotice; text_content: string | null };
      return { notice: { ...src.raw, noticeType: r.notice_type }, parsed: r.parsed as ParsedNotice, sourceId: r.source_id, text: src.text_content ?? "" };
    });

    const built = await buildContracts(proc.id, stored);
    contractsCount += built.length;
    // Rekord „część N”: zdarzenia proponujemy tylko dla umowy tej części (pozostałe części zostają jako kontekst).
    const { data: partRows } = await supabase.from("rm_contracts").select("id,part_no,cost_deviation_pct,delay_days").eq("procurement_id", proc.id);
    const hasScopePart = scopePart > 0 && (partRows ?? []).some((r) => r.part_no === scopePart);
    for (const contract of built) {
      const row = (partRows ?? []).find((r) => r.id === contract.contractId);
      if (hasScopePart && row?.part_no !== scopePart) continue;
      headline ??= { cost: row?.cost_deviation_pct ?? null, delay: row?.delay_days ?? null };
      changesCount += contract.changesCount;
      eventsCount += await proposeRuleEvents({
        projectId,
        contractId: contract.contractId,
        catalog: (catalog ?? []) as CatalogEntry[],
        notices: contract.notices.map((n) => ({ type: n.notice.noticeType, sourceId: n.sourceId, text: n.text })),
      });
    }
    if (!built.length) {
      log.push({ at: new Date().toISOString(), step: "Umowa", detail: "Brak ogłoszenia o wyniku i o wykonaniu umowy — umowy nie odtworzono (brak w źródle ≠ brak umowy)." });
    }
  }

  // Źródła dodatkowe (strona postępowania zamawiającego, TED) — po odtworzeniu umowy, żeby sprawdzić krzyżowo jej wartość.
  let external: ExternalCheckRow[] = [];
  try {
    external = await checkExternalSources(projectId, log);
  } catch (error) {
    log.push({ at: new Date().toISOString(), step: "Źródła dodatkowe", detail: `błąd: ${error instanceof Error ? error.message : String(error)}` });
  }

  await supabase.from("rm_projects").update({ enriched_at: new Date().toISOString(), enrichment_log: log, updated_at: new Date().toISOString() }).eq("id", projectId);
  return { projectId, external: external.map((e) => ({ source: e.source, status: e.status })), contracts: contractsCount, changes: changesCount, events: eventsCount, costDeviationPct: headline?.cost ?? null, delayDays: headline?.delay ?? null, pendingMatch };
}

/** Pełne, powtarzalne wzbogacenie projektu = wyszukiwanie + wzbogacanie. Upserty po identyfikatorach. */
export async function enrichProject(projectId: string): Promise<EnrichResult> {
  const search = await searchSources(projectId);
  const build = await buildProjectRecords(projectId);
  return { projectId, procurements: search.procurements, notices: search.notices, changes: build.changes, events: build.events, log: search.log };
}
