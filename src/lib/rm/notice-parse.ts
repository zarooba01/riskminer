/**
 * Deterministyczne parsowanie ogłoszeń BZP (formularze z 2021+). Bez LLM: pola formularza mają stałe etykiety,
 * więc kwoty, daty i zmiany umowy wyciągamy wyrażeniami regularnymi. Każde pole pamięta swoją etykietę,
 * żeby w interfejsie dało się pokazać fragment źródła.
 */

const entities: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&oacute;": "ó",
  "&Oacute;": "Ó",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z]+;|&#\d+;/g, (entity) => {
      if (entities[entity]) return entities[entity];
      const code = entity.match(/&#(\d+);/);
      return code ? String.fromCharCode(Number(code[1])) : " ";
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** "2107348,39 PLN" / "2 107 348,39" → 2107348.39 */
export function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.replace(/ /g, " ").match(/-?\d[\d\s]*(?:[.,]\d{1,2})?/);
  if (!match) return null;
  const value = Number(match[0].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

const dateRe = /(\d{4}-\d{2}-\d{2})/;

/** Wartość pola po etykiecie, np. field(text, "8.2.) Wartość umowy") — do końca linii. */
function field(text: string, label: RegExp): string | null {
  const match = text.match(new RegExp(`${label.source}[^:\\n]*:\\s*([^\\n]*)`, "i"));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** Okres realizacji bywa podany jako data końcowa („do 2025-08-18”). */
function periodEnd(raw: string | null): string | null {
  return raw?.match(dateRe)?.[1] ?? null;
}

function cleanPeriod(raw: string | null): string | null {
  return raw ? raw.split(/\s\d\.\d+\.?\)/)[0].trim() : null;
}

function months(raw: string | null): number | null {
  if (!raw || dateRe.test(raw)) return null;
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*(miesi|m-c)/i);
  if (m) return Number(m[1].replace(",", "."));
  const d = raw.match(/(\d+)\s*dni/i);
  if (d) return Math.round((Number(d[1]) / 30.4) * 10) / 10;
  return null;
}

function yesNo(raw: string | null): boolean | null {
  if (!raw) return null;
  if (/^tak/i.test(raw)) return true;
  if (/^nie/i.test(raw)) return false;
  return null;
}

export type ParsedContractChange = {
  changeNo: number | null;
  changedAt: string | null;
  legalBasis: string | null;
  reason: string | null;
  description: string | null;
  valueChange: number | null;
  priceIncrease: boolean | null;
};

export type ParsedPart = {
  partNo: number;
  title: string | null;
  resultStatus: string | null;
  offersCount: number | null;
  lowestOffer: number | null;
  highestOffer: number | null;
  contractorName: string | null;
  contractorNip: string | null;
  signedAt: string | null;
  contractValue: number | null;
  periodRaw: string | null;
  periodMonths: number | null;
  plannedEnd: string | null;
};

export type ParsedNotice = {
  noticeNumber?: string | null;
  ocid?: string | null;
  previousNoticeNumber?: string | null;
  euFunded?: boolean | null;
  procedure?: string | null;
  // wynik postępowania
  resultStatus?: string | null;
  offersCount?: number | null;
  lowestOffer?: number | null;
  highestOffer?: number | null;
  winningOffer?: number | null;
  // umowa
  contractorName?: string | null;
  contractorNip?: string | null;
  signedAt?: string | null;
  contractValue?: number | null;
  periodMonths?: number | null;
  periodRaw?: string | null;
  plannedEnd?: string | null;
  parts?: ParsedPart[];
  // wykonanie
  performed?: boolean | null;
  completedAt?: string | null;
  onTime?: boolean | null;
  changesCount?: number | null;
  paidTotal?: number | null;
  performedProperly?: boolean | null;
  changes?: ParsedContractChange[];
  // ogłoszenie o zamówieniu
  estimatedValue?: number | null;
  shortDescription?: string | null;
};

const multiline = (text: string, start: RegExp, end: RegExp): string | null => {
  const s = text.search(start);
  if (s < 0) return null;
  const rest = text.slice(s).replace(start, "");
  const e = rest.search(end);
  return (e < 0 ? rest : rest.slice(0, e)).trim() || null;
};

/** Zmiany umowy w ogłoszeniu o wykonaniu umowy (sekcja 5.4.x — powtarzające się bloki). */
function parsePerformingChanges(text: string): ParsedContractChange[] {
  const section = text.slice(Math.max(0, text.search(/5\.4\.1\.\)/)));
  const blocks = section.split(/5\.4\.2\.\)\s*Numer zmiany:/i).slice(1);
  return blocks.map((block) => {
    const upTo = (label: RegExp) => multiline(block, label, /\n\s*5\.\d+(\.\d+)?\.\)/);
    return {
      changeNo: parseAmount(block.split("\n")[0]),
      changedAt: null,
      legalBasis: upTo(/5\.4\.3\.\)\s*Podstawa prawna zmiany:/i),
      reason: upTo(/5\.4\.4\.\)\s*Przyczyny dokonania zmian:/i),
      description: upTo(/5\.4\.5\.\)\s*Krótki opis zamówienia po zmianie:/i),
      valueChange: parseAmount(upTo(/5\.4\.6\.\)\s*Wartość zmiany:/i)),
      priceIncrease: yesNo(field(block, /5\.4\.8\.\)\s*Wzrost ceny/)),
    };
  });
}

/** Ogłoszenie o zmianie umowy (AgreementUpdateNotice) — jedna zmiana w sekcji V. */
function parseUpdateChange(text: string): ParsedContractChange {
  const sectionV = text.slice(Math.max(0, text.search(/SEKCJA V/i)));
  const upTo = (label: RegExp) => multiline(sectionV, label, /\n?\s*5\.\d+\.\)/);
  return {
    changeNo: null,
    changedAt: field(sectionV, /5\.1\.\)\s*Data zmiany/)?.match(dateRe)?.[1] ?? null,
    legalBasis: upTo(/5\.2\.\)\s*Podstawa prawna zmiany[^:]*:/i),
    reason: upTo(/5\.3\.\)\s*Przyczyny dokonania zmian[^:]*:/i),
    description: upTo(/5\.4\.\)\s*Krótki opis zmiany[^:]*:/i),
    valueChange: parseAmount(upTo(/5\.5\.\)\s*Wartość zmiany[^:]*:/i)),
    priceIncrease: null,
  };
}

/** Ogłoszenie o wyniku: sekcje V–VIII powtarzają się „(dla części N)” przy zamówieniu w częściach. */
function parseResultParts(text: string): ParsedPart[] {
  const marker = /SEKCJA V ZAKOŃCZENIE POSTĘPOWANIA(?:\s*\(dla części (\d+)\))?/gi;
  const starts = [...text.matchAll(marker)];
  if (!starts.length) return [];
  const titles = new Map<number, string>();
  for (const m of text.matchAll(/\n\s*Część (\d+)\s*\n[^\n]*?(?:Część [IVXL]+\s*-\s*)?([^\n]{5,200})/g)) {
    if (!titles.has(Number(m[1]))) titles.set(Number(m[1]), m[2].trim());
  }
  return starts.map((m, i) => {
    const slice = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    const partNo = m[1] ? Number(m[1]) : 0;
    const period = cleanPeriod(field(slice, /8\.3\.\)\s*Okres realizacji/));
    return {
      partNo,
      title: partNo ? (titles.get(partNo) ?? null) : null,
      resultStatus: field(slice, /5\.1\.\)\s*Postępowanie zakończyło/),
      offersCount: parseAmount(field(slice, /6\.1\.\)\s*Liczba otrzymanych ofert/)),
      lowestOffer: parseAmount(field(slice, /6\.2\.\)/)),
      highestOffer: parseAmount(field(slice, /6\.3\.\)/)),
      contractorName: field(slice, /7\.3\.1\)\s*Nazwa/),
      contractorNip: field(slice, /7\.3\.2\)\s*Krajowy Numer/),
      signedAt: field(slice, /8\.1\.\)\s*Data zawarcia umowy/)?.match(dateRe)?.[1] ?? null,
      contractValue: parseAmount(field(slice, /8\.2\.\)\s*Wartość umowy/)),
      periodRaw: period,
      periodMonths: months(period),
      plannedEnd: periodEnd(period),
    };
  });
}

export function parseNotice(noticeType: string, text: string): ParsedNotice {
  const common: ParsedNotice = {
    ocid: text.match(/ocds-[0-9a-z-]+/i)?.[0] ?? null,
    euFunded: yesNo(field(text, /współfinansowanego ze środków Unii Europejskiej/)),
    procedure: field(text, /Tryb udzielenia zamówienia wraz z podstawą prawną/),
  };

  if (noticeType === "ContractNotice") {
    return {
      ...common,
      estimatedValue: parseAmount(field(text, /Wartość zamówienia/)),
      shortDescription: multiline(text, /Krótki opis przedmiotu zamówienia[^:\n]*:?/i, /\n\s*\d\.\d+(\.\d+)?\.\)/)?.slice(0, 4000),
    };
  }

  if (noticeType === "TenderResultNotice") {
    const parts = parseResultParts(text);
    const first = parts[0];
    return {
      ...common,
      previousNoticeNumber: field(text, /2\.14\.\)\s*Numer ogłoszenia/),
      parts,
      resultStatus: first?.resultStatus ?? null,
      offersCount: first?.offersCount ?? null,
      lowestOffer: first?.lowestOffer ?? null,
      highestOffer: first?.highestOffer ?? null,
      winningOffer: parseAmount(field(text, /6\.4\.\)/)),
      contractorName: first?.contractorName ?? null,
      contractorNip: first?.contractorNip ?? null,
      signedAt: first?.signedAt ?? null,
      contractValue: first?.contractValue ?? null,
      periodRaw: first?.periodRaw ?? null,
      periodMonths: first?.periodMonths ?? null,
      plannedEnd: first?.plannedEnd ?? null,
    };
  }

  if (noticeType === "ContractPerformingNotice") {
    const period = cleanPeriod(multiline(text, /4\.2\.\)\s*Okres realizacji zamówienia:/i, /4\.3\.\)/));
    return {
      ...common,
      previousNoticeNumber: field(text, /3\.2\.1\.\)\s*Numer ogłoszenia/),
      signedAt: field(text, /4\.1\.\)\s*Data zawarcia umowy/)?.match(dateRe)?.[1] ?? null,
      periodRaw: period,
      periodMonths: months(period),
      plannedEnd: periodEnd(period),
      contractorName: field(text, /4\.3\.1\.\)\s*Nazwa/),
      contractorNip: field(text, /4\.3\.2\.\)\s*Krajowy Numer/),
      contractValue: parseAmount(field(text, /4\.4\.\)\s*Wartość umowy/)),
      performed: yesNo(field(text, /5\.1\.\)\s*Czy umowa została wykonana/)),
      completedAt: field(text, /5\.2\.\)\s*Termin wykonania umowy/)?.match(dateRe)?.[1] ?? null,
      onTime: yesNo(field(text, /5\.3\.\)\s*Czy umowę wykonano w pierwotnie określonym terminie/)),
      changesCount: parseAmount(field(text, /5\.4\.1\.\)\s*Liczba zmian/)),
      paidTotal: parseAmount(field(text, /5\.5\.\)\s*Łączna wartość wynagrodzenia/)),
      performedProperly: yesNo(field(text, /5\.6\.\)\s*Czy umowa została wykonana należycie/)),
      changes: parsePerformingChanges(text),
    };
  }

  if (noticeType === "AgreementUpdateNotice") {
    return {
      ...common,
      signedAt: field(text, /4\.1\.\)\s*Data zawarcia umowy/)?.match(dateRe)?.[1] ?? null,
      contractValue: parseAmount(field(text, /4\.4\.\)\s*Wartość umowy/)),
      contractorName: field(text, /4\.3\.1\.\)\s*Nazwa/),
      changes: [parseUpdateChange(text)],
    };
  }

  return common;
}

/** Data zawarcia + okres w miesiącach → planowany termin (ISO). */
export function addMonths(isoDate: string, monthsCount: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const whole = Math.floor(monthsCount);
  date.setUTCMonth(date.getUTCMonth() + whole);
  date.setUTCDate(date.getUTCDate() + Math.round((monthsCount - whole) * 30.4));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
