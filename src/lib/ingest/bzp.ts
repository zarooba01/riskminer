import "server-only";

/**
 * Klient publicznego API ogłoszeń BZP (e-Zamówienia). Domyślnie kopia na czas HackNation (bez limitu zapytań);
 * produkcyjne API: BZP_BASE_URL=https://ezamowienia.gov.pl. API filtruje tylko po typie, dacie, regionie,
 * miejscowości, nazwie zamawiającego, przedmiocie i CPV — po NIP i identyfikatorze postępowania (OCID) filtrujemy u siebie.
 */

export const bzpBaseUrl = (process.env.BZP_BASE_URL ?? "https://bzp.cytr.us").replace(/\/$/, "");
const API_PATH = "/mo-board/api/v1/notice";

export const noticeTypes = ["ContractNotice", "TenderResultNotice", "AgreementUpdateNotice", "ContractPerformingNotice"] as const;
export type NoticeType = (typeof noticeTypes)[number];

export const noticeTypeLabel: Record<string, string> = {
  ContractNotice: "Ogłoszenie o zamówieniu",
  TenderResultNotice: "Ogłoszenie o wyniku postępowania",
  AgreementUpdateNotice: "Ogłoszenie o zmianie umowy",
  ContractPerformingNotice: "Ogłoszenie o wykonaniu umowy",
};

export type BzpNotice = {
  noticeType: string;
  noticeNumber: string;
  bzpNumber: string;
  publicationDate: string;
  orderObject: string;
  cpvCode: string | null;
  organizationName: string;
  organizationCity: string;
  organizationProvince: string;
  organizationNationalId: string;
  tenderId: string;
  contractors: { contractorName: string; contractorNationalId: string }[] | null;
  htmlBody: string;
  objectId: string;
};

export type BzpQuery = {
  NoticeType: NoticeType;
  NoticeNumber?: string;
  PublicationDateFrom?: string;
  PublicationDateTo?: string;
  OrganizationProvince?: string;
  OrganizationCity?: string;
  OrganizationName?: string;
  OrderObject?: string;
  CpvCode?: string;
  PageSize?: number;
  SearchAfter?: string;
};

export function noticeUrl(query: BzpQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `${bzpBaseUrl}${API_PATH}?${params}`;
}

/** Publiczny podgląd ogłoszenia w e-Zamówieniach (dla jury i eksperta) — po identyfikatorze obiektu z API BZP. */
export function noticePublicUrl(objectId: string): string {
  return `https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/${encodeURIComponent(objectId)}`;
}

async function fetchPage(query: BzpQuery): Promise<BzpNotice[]> {
  const response = await fetch(noticeUrl(query), { cache: "no-store", signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`BZP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  return Array.isArray(data) ? (data as BzpNotice[]) : [];
}

/** Wszystkie strony wyników (SearchAfter = objectId ostatniego rekordu), z bezpiecznikiem liczby stron. */
export async function searchNotices(query: BzpQuery, maxPages = 6): Promise<BzpNotice[]> {
  const pageSize = query.PageSize ?? 500;
  const all: BzpNotice[] = [];
  let searchAfter: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchPage({ ...query, PageSize: pageSize, SearchAfter: searchAfter });
    all.push(...batch);
    if (batch.length < pageSize) break;
    searchAfter = batch.at(-1)?.objectId;
  }
  return all;
}

/** "2022/BZP 00058537/01" i warianty zapisu → postać kanoniczna; bez wersji → "/01". */
export function normalizeNoticeNumber(raw: string): string | null {
  const m = raw.match(/(\d{4})\s*\/\s*BZP\s*0*(\d+)(?:\s*\/\s*(\d{1,2}))?/i);
  if (!m) return null;
  return `${m[1]}/BZP ${m[2].padStart(8, "0")}/${(m[3] ?? "01").padStart(2, "0")}`;
}

/** NIP: same cyfry + suma kontrolna. */
export function normalizeNip(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return null;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  return sum % 11 === Number(digits[9]) ? digits : null;
}
