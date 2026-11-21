import "server-only";

import { createHash } from "node:crypto";

import { extractText, getDocumentProxy } from "unpdf";

import { db } from "@/lib/supabase/admin";
import type { Project } from "@/lib/rm/types";

import { organizationNameKey, similarity, type LogEntry } from "./enrich";

/**
 * Źródła dodatkowe poza BZP — sprawdzane automatycznie przy wzbogacaniu:
 * 1. Strona postępowania u zamawiającego (platforma zakupowa / BIP) — adres z ogłoszenia o zamówieniu (pkt 3.1).
 *    Pobieramy listę dokumentów (SWZ, wzór umowy, informacja z otwarcia ofert, wybór oferty) i z kluczowych PDF
 *    sprawdzamy krzyżowo: numer BZP, wartość umowy, kwotę przeznaczoną na sfinansowanie zamówienia.
 * 2. TED (Dziennik Urzędowy UE) — publiczne API wyszukiwania, po nazwie zamawiającego i podobieństwie tytułu.
 * Wynik każdego sprawdzenia (także „nie znaleziono” i błąd) zapisujemy w rm_external_checks z podstawą dopasowania.
 */

const USER_AGENT = "Mozilla/5.0 (compatible; RiskMiner-prototyp/0.1; baza doswiadczen inwestycji publicznych)";
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();

export type PlatformDocument = { name: string; date: string | null; url: string };

export type ExternalCheckRow = {
  source: "platform" | "ted";
  status: "found" | "not_found" | "error" | "skipped";
  url: string | null;
  title: string | null;
  confidence: number | null;
  basis: string[];
  details: Record<string, unknown>;
  source_id: string | null;
};

/** Pobranie strony z obsługą przekierowań i ciasteczek (platformy zakupowe przekierowują przez SSO i z powrotem). */
async function fetchWithCookies(url: string, timeoutMs = 25_000): Promise<{ url: string; status: number; body: Buffer; contentType: string }> {
  const jar = new Map<string, string>();
  let current = url;
  const deadline = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 10; hop++) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/pdf,*/*", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_PDF_BYTES * 4) throw new Error(`Odpowiedź za duża (${Math.round(length / 1024 / 1024)} MB).`);
    return { url: current, status: response.status, body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "" };
  }
  throw new Error("Za dużo przekierowań.");
}

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Adres strony prowadzonego postępowania i strony zamawiającego z ogłoszenia o zamówieniu (sekcja I / III). */
export function procurementUrls(contractNoticeText: string): { procurementPage: string | null; buyerSite: string | null } {
  const norm = (raw: string | undefined) => {
    if (!raw) return null;
    const v = raw.trim().replace(/[),.;]+$/, "");
    if (!v || /^brak/i.test(v)) return null;
    if (v.startsWith("//")) return `https:${v}`;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  };
  const page = contractNoticeText.match(/Adres\s+strony\s+internetowej\s+prowadzonego\s+postępowania:?\s*((?:https?:)?\/\/\S+|www\.\S+|[\w.-]+\.[a-z]{2,}\/\S*)/i)?.[1];
  const buyer = contractNoticeText.match(/Adres\s+strony\s+internetowej\s+zamawiającego:?\s*((?:https?:)?\/\/\S+|www\.\S+|[\w.-]+\.[a-z]{2,}\S*)/i)?.[1];
  return { procurementPage: norm(page), buyerSite: norm(buyer) };
}

/** Lista dokumentów postępowania: wiersze tabeli z linkiem do pliku (platformazakupowa.pl) albo linki do plików. */
export function parseDocuments(html: string, baseUrl: string): PlatformDocument[] {
  const fileHref = /href="([^"]*(?:\/file\/|download|attachment|\.pdf|\.docx?|\.zip|\.xlsx?)[^"]*)"/i;
  const docs: PlatformDocument[] = [];
  const seen = new Set<string>();
  const add = (name: string, href: string, dateText: string | null) => {
    let url: string;
    try {
      url = new URL(decodeEntities(href), baseUrl).toString();
    } catch {
      return;
    }
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 3 || seen.has(url) || /\.(css|js|png|svg|ico)(\?|$)/i.test(url)) return;
    seen.add(url);
    docs.push({ name: clean.slice(0, 200), date: dateText, url });
  };
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const href = row.match(fileHref)?.[1];
    if (!href) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    const name = cells.find((c) => /\.\w{2,4}$/.test(c)) ?? cells.find((c) => c.length > 5);
    if (name) add(name, href, row.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null);
  }
  if (!docs.length) {
    for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      if (fileHref.test(`href="${m[1]}"`)) add(stripTags(m[2]), m[1], null);
    }
  }
  return docs.slice(0, 80);
}

const toAmount = (s: string) => Number(s.replace(/[\s.]/g, "").replace(",", "."));
/** Kwota w zapisie dokumentów („2 131 590,00”) — do wyszukania w tekście. */
const amountVariants = (v: number) => {
  const fixed = v.toFixed(2).replace(".", ",");
  const [int, dec] = fixed.split(",");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return [`${grouped},${dec}`, `${int},${dec}`, `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`];
};

/** Kwota, jaką zamawiający zamierza przeznaczyć na sfinansowanie zamówienia (art. 222 ust. 4 Pzp). */
export function findBudget(text: string): { amount: number; quote: string } | null {
  const flat = text.replace(/\s+/g, " ");
  const m = flat.match(/(kwot\w*[^.]{0,160}?(?:przeznacz\w*|zamierza)[^.]{0,220}?)(\d{1,3}(?:[\s.]\d{3})+,\d{2}|\d+,\d{2})\s*(?:zł|PLN)/i);
  if (!m) return null;
  const amount = toAmount(m[2]);
  return amount > 1000 ? { amount, quote: `${m[1]}${m[2]} zł`.trim().slice(0, 400) } : null;
}

async function readPdf(buffer: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((p) => p.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
}

async function upsertExternalSource(kind: "platform" | "ted", externalId: string, title: string, url: string, text: string, raw: Record<string, unknown>, hash: string) {
  const { data, error } = await db()
    .from("rm_sources")
    .upsert({ kind, external_id: externalId.slice(0, 500), title: title.slice(0, 500), url, fetched_at: now(), content_hash: hash, raw, text_content: text }, { onConflict: "kind,external_id" })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis źródła: ${error.message}`);
  return data.id as string;
}

type ProcurementRef = { id: string; bzp_number: string | null; title: string | null; status: string };
type ContractRef = { initial_value: number | null; contractor_name: string | null };

/** Strona postępowania u zamawiającego: dokumenty + sprawdzenie krzyżowe z danymi z BZP. */
async function checkPlatform(input: { procurement: ProcurementRef; contractNoticeText: string; contract: ContractRef | null; log: LogEntry[] }): Promise<ExternalCheckRow> {
  const { procurement, contractNoticeText, contract, log } = input;
  const { procurementPage, buyerSite } = procurementUrls(contractNoticeText);
  const base = { source: "platform" as const, confidence: null, source_id: null };
  if (!procurementPage) {
    log.push({ at: now(), step: "Strona postępowania", detail: "Ogłoszenie nie podaje adresu strony prowadzonego postępowania." });
    return { ...base, status: "skipped", url: buyerSite, title: null, basis: ["ogłoszenie nie podaje adresu strony postępowania"], details: { buyerSite } };
  }
  try {
    const page = await fetchWithCookies(procurementPage);
    if (page.status >= 400) throw new Error(`HTTP ${page.status}`);
    const html = page.body.toString("utf8");
    const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/^Postępowanie:\s*/i, "").replace(/\s*[-|–]\s*Platforma Zakupowa.*$/i, "") || null;
    const documents = parseDocuments(html, page.url);
    const bzpDigits = procurement.bzp_number?.match(/BZP\s*(\d{6,})/)?.[1] ?? null;
    const flatHtml = html.replace(/\s+/g, " ");
    const pageHasBzp = Boolean(bzpDigits && flatHtml.includes(bzpDigits));
    const titleSim = title && procurement.title ? similarity(title, procurement.title) : 0;
    const basis: string[] = [];
    if (pageHasBzp) basis.push(`na stronie występuje numer ogłoszenia BZP ${procurement.bzp_number}`);
    if (title) basis.push(`tytuł postępowania zgodny w ${Math.round(titleSim * 100)}%: „${title.slice(0, 140)}”`);
    basis.push(`dokumentów postępowania: ${documents.length}`);

    // Kluczowe PDF: informacja o kwocie / z otwarcia ofert / o wyborze oferty — najwyżej 3, każdy ≤ 4 MB.
    const key = documents.filter((d) => /\.pdf(\?|$)|\.pdf$/i.test(d.url) || /\.pdf$/i.test(d.name)).filter((d) => /kwot|otwarci|wyb[oó]r|unieważni/i.test(d.name)).slice(0, 3);
    const docSources: { name: string; sourceId: string; url: string }[] = [];
    let budget: { amount: number; quote: string; sourceId: string; document: string } | null = null;
    let valueConfirmed: string | null = null;
    let bzpInDocs = false;
    for (const doc of key) {
      try {
        const file = await fetchWithCookies(doc.url, 20_000);
        if (file.status >= 400 || file.body.length > MAX_PDF_BYTES || !/pdf/i.test(file.contentType + doc.name)) continue;
        const pages = await readPdf(file.body);
        const text = pages.map((p, i) => `[str. ${i + 1}]\n${p}`).join("\n\n");
        if (text.replace(/\s/g, "").replace(/\[str\.\d+\]/g, "").length < 50) {
          log.push({ at: now(), step: "Dokument zamawiającego", detail: `${doc.name}: skan bez warstwy tekstowej — pominięto (OCR niedostępny)`, url: doc.url });
          continue;
        }
        const sourceId = await upsertExternalSource("platform", doc.url, `Dokument zamawiającego: ${doc.name}`, doc.url, text, { document: doc, procurementPage }, sha(file.body));
        docSources.push({ name: doc.name, sourceId, url: doc.url });
        const flat = text.replace(/\s+/g, " ");
        if (bzpDigits && flat.includes(bzpDigits)) bzpInDocs = true;
        if (contract?.initial_value && amountVariants(contract.initial_value).some((v) => flat.includes(v))) valueConfirmed = doc.name;
        const found: { amount: number; quote: string } | null = budget ? null : findBudget(text);
        if (found) budget = { ...found, sourceId, document: doc.name };
      } catch (error) {
        log.push({ at: now(), step: "Dokument zamawiającego", detail: `${doc.name}: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
    if (bzpInDocs) basis.push("dokumenty zamawiającego powołują się na ten sam numer BZP");
    if (valueConfirmed && contract?.initial_value) basis.push(`wartość umowy z BZP (${amountVariants(contract.initial_value)[0]} zł) występuje w dokumencie „${valueConfirmed}”`);
    if (budget) basis.push(`kwota przeznaczona na sfinansowanie: ${amountVariants(budget.amount)[0]} zł („${budget.document}”)`);

    // Platformy będące aplikacjami JS (np. Marketplanet, Logintrade) bez przeglądarki zwracają pustą powłokę.
    if (!pageHasBzp && titleSim < 0.2 && !documents.length) {
      log.push({ at: now(), step: "Strona postępowania zamawiającego", detail: `strona „${title ?? page.url}” nie udostępnia treści bez przeglądarki`, url: page.url });
      return { ...base, status: "error", url: page.url, title: null, basis: [`platforma „${title ?? new URL(page.url).hostname}” nie udostępnia treści bez przeglądarki — dokumenty pod linkiem`], details: { buyerSite } };
    }
    const confidence = Math.min(1, 0.3 + (pageHasBzp ? 0.35 : 0) + (bzpInDocs ? 0.1 : 0) + titleSim * 0.4);
    const listing = [
      `Strona postępowania: ${page.url}`,
      title ? `Tytuł: ${title}` : null,
      buyerSite ? `Strona internetowa zamawiającego (BIP): ${buyerSite}` : null,
      "",
      "Dokumenty postępowania:",
      ...documents.map((d) => `- ${d.name}${d.date ? ` (${d.date})` : ""}`),
    ]
      .filter((l) => l !== null)
      .join("\n");
    const sourceId = await upsertExternalSource("platform", procurementPage, `Strona postępowania: ${title ?? procurementPage}`, page.url, listing, { documents, buyerSite, title }, sha(html));
    const status = pageHasBzp || titleSim >= 0.5 ? "found" : "not_found";
    log.push({ at: now(), step: "Strona postępowania zamawiającego", detail: `${status === "found" ? "zgodna z BZP" : "niezgodna z BZP"}: ${documents.length} dokumentów, pewność ${Math.round(confidence * 100)}%`, url: page.url, count: documents.length });
    return {
      source: "platform",
      status,
      url: page.url,
      title,
      confidence: Math.round(confidence * 100) / 100,
      basis,
      details: { documents, documentSources: docSources, buyerSite, budget, valueConfirmed, pageHasBzp, titleSimilarity: Math.round(titleSim * 100) / 100 },
      source_id: sourceId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.push({ at: now(), step: "Strona postępowania zamawiającego", detail: `nie udało się pobrać: ${message}`, url: procurementPage });
    return { ...base, status: "error", url: procurementPage, title: null, basis: [`błąd pobrania: ${message}`], details: { buyerSite } };
  }
}

type TedNotice = { "publication-number": string; "notice-title"?: Record<string, string | string[]>; "buyer-name"?: Record<string, string[]>; "publication-date"?: string; "notice-type"?: string };
/** Tytuły TED zaczynają się od „Polska – Roboty budowlane – …” — przedrostek nie mówi nic o przedmiocie. */
const tedTitle = (t: string) => t.replace(/^\s*Polska\s*[–-]\s*[^–-]+[–-]\s*/i, "");
const pick = (v: Record<string, string | string[]> | undefined) => {
  const x = v?.pol ?? v?.eng ?? Object.values(v ?? {})[0];
  return Array.isArray(x) ? x.join(" ") : (x ?? "");
};

/** TED: ogłoszenia zamawiającego od roku przed ogłoszeniem w BZP, dopasowanie po tytule. */
async function checkTed(input: { project: Project; procurement: ProcurementRef; publishedYear: number | null; belowEu: boolean | null; log: LogEntry[] }): Promise<ExternalCheckRow> {
  const { project, procurement, publishedYear, belowEu, log } = input;
  const nameKey = organizationNameKey(project.beneficiary_name);
  const base = { source: "ted" as const, source_id: null };
  if (!nameKey) return { ...base, status: "skipped", url: null, title: null, confidence: null, basis: ["brak nazwy zamawiającego do wyszukania"], details: {} };
  const from = `${(publishedYear ?? new Date().getFullYear()) - 1}0101`;
  const query = `buyer-name ~ "${nameKey.replace(/"/g, "")}" AND publication-date>=${from}`;
  const searchUrl = `https://ted.europa.eu/pl/search/result?FT=${encodeURIComponent(nameKey)}`;
  try {
    const response = await fetch("https://api.ted.europa.eu/v3/notices/search", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ query, fields: ["publication-number", "notice-title", "buyer-name", "publication-date", "notice-type"], limit: 50 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`TED ${response.status}`);
    const notices = ((await response.json()).notices ?? []) as TedNotice[];
    const scored = notices
      .map((n) => ({ n, title: pick(n["notice-title"]), sim: procurement.title ? similarity(tedTitle(pick(n["notice-title"])), procurement.title) : 0 }))
      .sort((a, b) => b.sim - a.sim);
    const best = scored[0];
    const thresholdNote = belowEu ? "zamówienie poniżej progów UE — publikacja w TED nie była wymagana" : null;
    if (!best || best.sim < 0.7) {
      log.push({ at: now(), step: "TED", detail: `${notices.length} ogłoszeń zamawiającego „${nameKey}” od ${from.slice(0, 4)} r., brak zgodnego tytułu${thresholdNote ? ` (${thresholdNote})` : ""}`, count: 0 });
      return {
        ...base,
        status: "not_found",
        url: searchUrl,
        title: null,
        confidence: null,
        basis: [`sprawdzono ${notices.length} ogłoszeń zamawiającego w TED od ${from.slice(0, 4)} r.`, best ? `najbliższy tytuł zgodny w ${Math.round(best.sim * 100)}%` : "brak ogłoszeń", ...(thresholdNote ? [thresholdNote] : [])],
        details: { query, checked: notices.length },
      };
    }
    const pub = best.n["publication-number"];
    const url = `https://ted.europa.eu/pl/notice/-/detail/${pub}`;
    const text = [`Ogłoszenie TED ${pub}`, `Tytuł: ${best.title}`, `Zamawiający: ${pick(best.n["buyer-name"])}`, `Data publikacji: ${best.n["publication-date"] ?? "—"}`, `Typ: ${best.n["notice-type"] ?? "—"}`].join("\n");
    const sourceId = await upsertExternalSource("ted", pub, `TED ${pub} — ${best.title}`, url, text, best.n as unknown as Record<string, unknown>, sha(text));
    log.push({ at: now(), step: "TED", detail: `${pub}: tytuł zgodny w ${Math.round(best.sim * 100)}%`, url, count: 1 });
    return {
      ...base,
      status: "found",
      url,
      title: best.title,
      confidence: Math.round(Math.min(0.95, 0.3 + best.sim * 0.65) * 100) / 100,
      basis: [`nazwa zamawiającego „${nameKey}”`, `tytuł zgodny w ${Math.round(best.sim * 100)}%: „${best.title.slice(0, 140)}”`],
      details: { query, checked: notices.length, publicationNumber: pub },
      source_id: sourceId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.push({ at: now(), step: "TED", detail: `błąd: ${message}` });
    return { ...base, status: "error", url: searchUrl, title: null, confidence: null, basis: [`błąd zapytania: ${message}`], details: { query } };
  }
}

/**
 * Sprawdzenie źródeł dodatkowych dla najlepszego dopasowania projektu. Nie przerywa wzbogacania — błędy trafiają
 * do wyniku sprawdzenia i dziennika. Potwierdzenie na stronie zamawiającego dopisujemy do podstawy dopasowania.
 */
const externalSteps = new Set(["Strona postępowania", "Strona postępowania zamawiającego", "Dokument zamawiającego", "TED", "Źródła dodatkowe"]);

export async function checkExternalSources(projectId: string, log: LogEntry[]): Promise<ExternalCheckRow[]> {
  const supabase = db();
  // Dziennik zawiera tylko ostatnie sprawdzenie źródeł dodatkowych (ponowne wzbogacenie nie dopisuje kolejnych kopii).
  for (let i = log.length - 1; i >= 0; i--) if (externalSteps.has(log[i].step)) log.splice(i, 1);
  const { data: project } = await supabase.from("rm_projects").select("*").eq("id", projectId).single();
  const { data: procs } = await supabase.from("rm_procurements").select("id,bzp_number,title,status,match_basis,match_confidence").eq("project_id", projectId).neq("status", "rejected").order("match_confidence", { ascending: false });
  const procurement = ((procs ?? []).find((p) => p.status === "accepted") ?? procs?.[0]) as (ProcurementRef & { match_basis: string[]; match_confidence: number }) | undefined;
  if (!project || !procurement) return [];

  const { data: cn } = await supabase
    .from("rm_notices")
    .select("published_at, rm_sources!inner(text_content,raw)")
    .eq("procurement_id", procurement.id)
    .eq("notice_type", "ContractNotice")
    .maybeSingle();
  const src = (cn ? (Array.isArray(cn.rm_sources) ? cn.rm_sources[0] : cn.rm_sources) : null) as { text_content: string | null; raw: { isTenderAmountBelowEU?: boolean } | null } | null;
  const { data: contract } = await supabase.from("rm_contracts").select("initial_value,contractor_name").eq("procurement_id", procurement.id).order("part_no").limit(1).maybeSingle();

  const [platform, ted] = await Promise.all([
    checkPlatform({ procurement, contractNoticeText: src?.text_content ?? "", contract: (contract as ContractRef | null) ?? null, log }),
    checkTed({ project: project as Project, procurement, publishedYear: cn?.published_at ? Number(String(cn.published_at).slice(0, 4)) : null, belowEu: src?.raw?.isTenderAmountBelowEU ?? null, log }),
  ]);

  for (const row of [platform, ted]) {
    const { error } = await supabase.from("rm_external_checks").upsert({ project_id: projectId, ...row, checked_at: now() }, { onConflict: "project_id,source" });
    if (error) throw new Error(`Zapis sprawdzenia źródła: ${error.message}`);
  }

  // Niepewne dopasowanie (np. rekord KPO) potwierdzone na stronie zamawiającego — dopisujemy podstawę dla eksperta.
  if (platform.status === "found" && procurement.status === "proposed") {
    const note = `potwierdzone na stronie postępowania zamawiającego (${platform.basis[0] ?? "zgodny tytuł"})`;
    if (!procurement.match_basis.includes(note)) {
      await supabase
        .from("rm_procurements")
        .update({ match_basis: [...procurement.match_basis, note], match_confidence: Math.min(0.95, Math.round((procurement.match_confidence + 0.05) * 100) / 100) })
        .eq("id", procurement.id);
    }
  }
  return [platform, ted];
}
