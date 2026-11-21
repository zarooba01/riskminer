import "server-only";

import { classifySubsectors } from "@/lib/ingest/xlsx";

import { defaultWeights, provinceOptions, type AssessmentParams, type ParamKey, type ParamOrigin } from "./types";

const num = (s: string) => Number(s.replace(/[\s ]/g, "").replace(",", "."));

/**
 * Długość sieci w metrach z tekstu: „3 km”, „o długości 22,616 km”, „L=1250 m”, „850 mb”.
 * Bierzemy większą z dwóch wartości: sumy długości przy słowie „długość/L=” (np. sieć wodociągowa + kanalizacja)
 * i największej podanej długości — krótki odcinek „o długości 400 m” nie zastąpi całej sieci „3,2 km”.
 */
export function extractLengthM(text: string): number | null {
  const re = /(długoś\w*\s*(?:ok\.?\s*|około\s*|ca\.?\s*)?|L\s*=\s*)?(\d{1,3}(?:[ \s]\d{3})*(?:[,.]\d+)?|\d+(?:[,.]\d+)?)\s*(km|mb|m)(?![\wąćęłńóśźż-])/gi;
  const withLabel: number[] = [];
  const all: number[] = [];
  for (const m of text.matchAll(re)) {
    const value = num(m[2]) * (m[3].toLowerCase() === "km" ? 1000 : 1);
    if (!Number.isFinite(value) || value <= 0 || value > 500_000) continue;
    all.push(value);
    if (m[1]) withLabel.push(value);
  }
  if (!all.length) return null;
  return Math.round(Math.max(withLabel.reduce((a, b) => a + b, 0), ...all));
}

/** Budżet w PLN: „budżet 4 mln zł”, „3,5 mln”, „koszt ok. 800 tys. zł”, „wartość 2 500 000 zł”. */
export function extractBudget(text: string): number | null {
  const re = /(\d{1,3}(?:[ \s]\d{3})+(?:[,.]\d+)?|\d+(?:[,.]\d+)?)\s*(mln|milion\w*|tys\.?|tysi\w*|zł|pln)/gi;
  for (const m of text.matchAll(re)) {
    const unit = m[2].toLowerCase();
    const factor = unit.startsWith("mln") || unit.startsWith("milion") ? 1_000_000 : unit.startsWith("tys") ? 1000 : 1;
    const value = num(m[1]) * factor;
    // Kwota bez słowa „budżet/koszt/wartość/limit…” przed nią w tym samym zdaniu (może być w nagłówku linię wyżej)
    // nie jest budżetem planu (np. pozycja z protokołu) — chyba że podana w mln.
    const before = text.slice(Math.max(0, (m.index ?? 0) - 120), m.index);
    const context = /(budżet|koszt|wartoś|kwot|szacun|nakład|środk|przeznacz|limit)[^.]*$/i.test(before);
    if (value >= 10_000 && (context || factor === 1_000_000)) return Math.round(value);
  }
  return null;
}

const monthNames = ["stycz", "lut", "marc", "kwiet", "maj", "czerw", "lip", "sierp", "wrze", "paźdz", "listop", "grud"];
const datePattern = /(?:(\d{1,2})\s+)?(stycz\w*|lut\w*|marc\w*|kwie\w*|maj\w*|czerw\w*|lip\w*|sierp\w*|wrze\w*|paźdz\w*|listop\w*|grud\w*)\s+(20\d\d)|(\d{1,2})[./-](\d{1,2})[./-](20\d\d)/gi;

/** Daty z tekstu (słownie lub liczbowo) z pozycją — do wyliczenia okresu „podpisanie umowy → odbiór”. */
function datesIn(text: string): { index: number; month: number }[] {
  const out: { index: number; month: number }[] = [];
  for (const m of text.matchAll(datePattern)) {
    const month = m[2] ? monthNames.findIndex((n) => m[2].toLowerCase().startsWith(n)) + 1 : Number(m[5]);
    const year = Number(m[3] ?? m[6]);
    if (month >= 1 && month <= 12) out.push({ index: m.index ?? 0, month: year * 12 + month });
  }
  return out;
}

/**
 * Czas realizacji w miesiącach: „12 miesięcy”, „18 m-cy”, „2 lata”; albo z dat: od podpisania umowy do odbioru /
 * zakończenia robót („podpisanie umowy do końca grudnia 2027 r. … odbiór do 30 listopada 2028 r.” → 11).
 */
export function extractDurationMonths(text: string, now = new Date()): number | null {
  const months = text.match(/(\d{1,3})\s*(?:miesi\w*|m-c\w*|mies\.?)/i);
  if (months) return Number(months[1]);
  const years = text.match(/(\d{1,2}(?:[,.]5)?)\s*(?:lat\w*|rok\w*|lata)\b/i);
  if (years) return Math.round(num(years[1]) * 12);

  const dates = datesIn(text);
  const near = (re: RegExp) => dates.find((d) => re.test(text.slice(Math.max(0, d.index - 80), d.index)));
  const start = near(/(podpisan|zawarci)\w*\s+umow|umow\w*\s+(?:na roboty\s+)?(?:zostanie\s+)?(?:podpisan|zawart)|rozpoczęci\w*\s+robót/i);
  const end = [...dates].reverse().find((d) => d !== start && /(odbi[oó]r|zakończeni\w*|wykonani\w*|oddani\w*)[^.]*$/i.test(text.slice(Math.max(0, d.index - 80), d.index)));
  if (start && end && end.month > start.month) return end.month - start.month;

  const until = text.match(/do\s+(?:końca\s+)?(?:(\d{1,2})[./-])?(20\d\d)/i);
  if (until) {
    const year = Number(until[2]);
    const month = until[1] ? Number(until[1]) : 12;
    const diff = (year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1));
    return diff > 0 && diff < 120 ? diff : null;
  }
  return null;
}

const provinceStems = provinceOptions.map((p) => ({ name: p, stem: p.replace(/kie$/, "") }));

export function extractProvince(text: string): string | null {
  const t = text.toLowerCase();
  return provinceStems.find((p) => t.includes(p.stem))?.name ?? null;
}

/**
 * Słownik warunków lokalnych → kod ryzyka katalogu. Celowo węższy niż słowa kluczowe katalogu (te służą do klasyfikacji
 * zmian umów, a w opisie planu „termin” czy „zgoda” występują zawsze). Rozszerzany przez słowa kluczowe katalogu w run.ts.
 */
export const localConditionTerms: Record<string, string[]> = {
  R02: ["geotechn", "grunty", "gruntów", "wody gruntowe", "wód gruntowych", "podmokł", "torf", "skarp", "kurzawk", "stan istniejąc"],
  R03: ["kolizj", "uzbrojeni", "właściciel", "działk", "prywatn", "służebn", "pas drogow", "pasie drogow", "zarządc", "dostęp do teren", "kolej"],
  R04: ["uzgodnie", "pozwoleni", "decyzj", "środowiskow", "wodnoprawn", "konserwator", "natura 2000", "warunki techniczne", "warunków technicznych", "gestor", "włączeni", "włączenia", "przyłączeni do sieci"],
  R06: ["krótki termin", "pilne", "zim", "harmonogram"],
  R13: ["dofinansow", "kpo", "fundusz", "ograniczony budżet", "wpf"],
  R15: ["przepustowo", "rlm", "deklaracj", "efekt ekologiczn"],
  R11: ["jedna oferta", "brak ofert", "odwołani", "kio"],
  R12: ["dostaw", "materiał"],
};

/** Kody ryzyk wywołane przez frazy w opisie lub warunkach lokalnych (z frazami jako wyjaśnieniem). */
export function detectConditions(text: string): { code: string; terms: string[] }[] {
  const t = text.toLowerCase();
  return Object.entries(localConditionTerms)
    .map(([code, terms]) => ({ code, terms: [...new Set(terms.filter((term) => t.includes(term)).map((term) => surfaceOf(t, term)))] }))
    .filter((d) => d.terms.length > 0);
}

/** Całe słowo z tekstu zawierające rdzeń (do pokazania użytkownikowi, np. „kolizje” zamiast „kolizj”). */
function surfaceOf(text: string, stem: string): string {
  const i = text.indexOf(stem);
  if (i < 0) return stem;
  let start = i;
  while (start > 0 && /[\wąćęłńóśźż]/i.test(text[start - 1])) start--;
  let end = i + stem.length;
  while (end < text.length && /[\wąćęłńóśźż-]/i.test(text[end])) end++;
  return text.slice(start, end);
}

export type ParamInput = Partial<Record<ParamKey, string | number | null>> & { weights?: Partial<AssessmentParams["weights"]>; top_k?: number };

/**
 * Parametry oceny: wartości wpisane przez użytkownika mają pierwszeństwo, brakujące odczytujemy regułami z opisu
 * i tekstu dokumentu. Zwraca też pochodzenie każdego pola (wymóg: odróżniać dane wejściowe od wniosków).
 */
export function resolveParams(text: string, input: ParamInput, previousOrigin: Partial<Record<ParamKey, ParamOrigin>> = {}): {
  params: AssessmentParams;
  origin: Partial<Record<ParamKey, ParamOrigin>>;
} {
  const origin: Partial<Record<ParamKey, ParamOrigin>> = {};
  const given = <T>(key: ParamKey, value: T | null | undefined): value is T => {
    const ok = value !== undefined && value !== null && value !== "" && !(typeof value === "number" && !Number.isFinite(value));
    if (ok) origin[key] = previousOrigin[key] === "llm" ? "llm" : "input";
    return ok;
  };
  const rule = <T>(key: ParamKey, value: T | null): T | null => {
    if (value !== null && value !== undefined) origin[key] = "rule";
    return value;
  };
  const numeric = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/\s/g, "").replace(",", ".")));

  const sub = classifySubsectors(text);
  const subsector = String(input.subsector_main ?? "");
  const works = String(input.works_type ?? "");
  const province = String(input.province ?? "");
  const length = numeric(input.length_m);
  const budget = numeric(input.budget_pln);
  const duration = numeric(input.duration_months);
  const local = String(input.local_conditions ?? "").trim();

  const params: AssessmentParams = {
    subsector_main: given("subsector_main", subsector) ? subsector : rule("subsector_main", text.trim() ? sub.main : null),
    subsectors_extra: sub.extra.filter((s) => s !== subsector),
    works_type: given("works_type", works) ? works : rule("works_type", sub.worksType),
    province: given("province", province) ? province : rule("province", extractProvince(text)),
    length_m: given("length_m", length) ? length : rule("length_m", extractLengthM(text)),
    budget_pln: given("budget_pln", budget) ? budget : rule("budget_pln", extractBudget(text)),
    duration_months: given("duration_months", duration) ? duration : rule("duration_months", extractDurationMonths(text)),
    local_conditions: given("local_conditions", local) ? local : null,
    weights: { ...defaultWeights, ...(input.weights ?? {}) },
    top_k: Math.min(15, Math.max(3, Number(input.top_k ?? 8))),
  };
  return { params, origin };
}
