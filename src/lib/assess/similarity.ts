import type { AssessmentParams, MatchComponent, Weights } from "./types";
import { weightLabels } from "./types";

/** Słowa bez znaczenia dla zakresu robót (polskie spójniki, przyimki i ogólniki z tytułów zamówień). */
const stop = new Set(
  "oraz wraz dla przez przy pod nad bez jest są będzie który która które tego tej tym ten ta to też lub albo czy jak jako ich jej jego się nie tak także około ok etc zadanie zadania zamówienie zamówienia realizacja realizacji wykonanie wykonania projekt projektu inwestycja inwestycji gmina gminie gminy miejscowości miejscowość miejscowosci terenie teren chcemy planujemy plan planowany planowana ulicy ulica część części etap etapie roku robót roboty zakres zakresie zł mln tys km długości budżet koszt termin miesięcy".split(" "),
);

/** Rdzeń słowa: obcięcie końcówek fleksyjnych (prosty stemming wystarczający do porównania tytułów i opisów). */
const stem = (w: string) => (w.length > 6 ? w.slice(0, 6) : w);

export function tokenize(text: string): { stems: string[]; surface: Map<string, string> } {
  const surface = new Map<string, string>();
  const stems: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-ząćęłńóśźż]{3,}/g) ?? []) {
    if (stop.has(raw)) continue;
    const s = stem(raw);
    if (!surface.has(s)) surface.set(s, raw);
    stems.push(s);
  }
  return { stems, surface };
}

export type TfIdfIndex = { idf: Map<string, number>; vectors: Map<string, number>[] };

function vectorize(stems: string[], idf: Map<string, number>) {
  const tf = new Map<string, number>();
  for (const s of stems) tf.set(s, (tf.get(s) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [s, count] of tf) vec.set(s, (1 + Math.log(count)) * (idf.get(s) ?? 0));
  return vec;
}

/** TF-IDF dla zapytania i dokumentów przypadków; zwraca podobieństwo cosinusowe i wspólne terminy o największej wadze. */
export function textSimilarity(query: string, docs: string[]): { score: number; shared: string[] }[] {
  const q = tokenize(query);
  const tokenized = docs.map((d) => tokenize(d));
  const df = new Map<string, number>();
  for (const t of [q, ...tokenized]) for (const s of new Set(t.stems)) df.set(s, (df.get(s) ?? 0) + 1);
  const n = docs.length + 1;
  const idf = new Map([...df].map(([s, d]) => [s, Math.log((n + 1) / (d + 1)) + 1]));
  const qv = vectorize(q.stems, idf);
  const qNorm = Math.sqrt([...qv.values()].reduce((a, v) => a + v * v, 0));
  return tokenized.map((t) => {
    const dv = vectorize(t.stems, idf);
    const dNorm = Math.sqrt([...dv.values()].reduce((a, v) => a + v * v, 0));
    const contributions: [string, number][] = [];
    let dot = 0;
    for (const [s, w] of qv) {
      const other = dv.get(s);
      if (other) {
        dot += w * other;
        contributions.push([s, w * other]);
      }
    }
    const score = qNorm && dNorm ? dot / (qNorm * dNorm) : 0;
    const shared = contributions
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => q.surface.get(s) ?? t.surface.get(s) ?? s);
    return { score, shared };
  });
}

/** Podobieństwo skali w skali logarytmicznej: 1 przy równych wartościach, 0 przy 4-krotnej różnicy. */
export const scaleSimilarity = (a: number, b: number) => Math.max(0, 1 - Math.abs(Math.log(a / b)) / Math.log(4));

export type CaseFeatures = {
  project_id: string;
  subsector_main: string | null;
  subsectors_extra: string[];
  works_type: string | null;
  province: string | null;
  value: number | null;
  length_m: number | null;
};

const fmtLen = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`);
const fmtPln = (v: number) => `${(v / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} mln zł`;

/**
 * Wynik podobieństwa 0–100 jako ważona suma cech. Cecha jest „stosowalna”, gdy opis planu ją podaje — inaczej nie wpływa
 * na wynik (wagi renormalizujemy), a brak po stronie przypadku obniża wartość cechy. Każda cecha ma zdanie wyjaśnienia.
 */
export function scoreCase(params: AssessmentParams, c: CaseFeatures, text: { score: number; shared: string[] }): { score: number; components: MatchComponent[]; reasons: string[] } {
  const w: Weights = params.weights;
  const components: MatchComponent[] = [];
  const add = (feature: keyof Weights, applicable: boolean, value: number, detail: string) =>
    components.push({ feature, label: weightLabels[feature], weight: w[feature], value: Math.round(value * 100) / 100, points: 0, detail, applicable });

  // Podsektor: główny = główny → 1; główny ↔ dodatkowy → 0,5.
  if (params.subsector_main) {
    const same = c.subsector_main === params.subsector_main;
    const partial = !same && (c.subsectors_extra.includes(params.subsector_main) || (c.subsector_main ? params.subsectors_extra.includes(c.subsector_main) : false));
    add("subsector", true, same ? 1 : partial ? 0.5 : 0, same ? `ten sam podsektor: ${c.subsector_main}` : partial ? `podsektor dodatkowy: ${params.subsector_main}` : `inny podsektor (${c.subsector_main ?? "brak"})`);
  } else add("subsector", false, 0, "podsektor planu nieokreślony");

  if (params.works_type) {
    const same = c.works_type === params.works_type;
    add("works", true, same ? 1 : c.works_type ? 0 : 0.3, same ? `ten sam rodzaj robót: ${c.works_type}` : c.works_type ? `inny rodzaj robót (${c.works_type})` : "rodzaj robót przypadku nieznany");
  } else add("works", false, 0, "rodzaj robót planu nieokreślony");

  // Zakres: cosinus TF-IDF; 0,2 cosinusa traktujemy już jako pełną zgodność treści (krótkie opisy).
  const scopeValue = Math.min(1, text.score / 0.2);
  add("scope", true, scopeValue, text.shared.length ? `wspólne pojęcia: ${text.shared.join(", ")}` : "brak wspólnych pojęć w opisach");

  // Skala: budżet ↔ wartość umowy i długość ↔ długość (średnia dostępnych porównań).
  const scaleParts: { v: number; d: string }[] = [];
  if (params.budget_pln) scaleParts.push(c.value ? { v: scaleSimilarity(params.budget_pln, c.value), d: `wartość umowy ${fmtPln(c.value)} vs budżet ${fmtPln(params.budget_pln)}` } : { v: 0.3, d: "brak wartości umowy w przypadku" });
  if (params.length_m) scaleParts.push(c.length_m ? { v: scaleSimilarity(params.length_m, c.length_m), d: `długość ${fmtLen(c.length_m)} vs ${fmtLen(params.length_m)}` } : { v: 0.3, d: "długość sieci przypadku nieznana" });
  if (scaleParts.length) add("scale", true, scaleParts.reduce((a, p) => a + p.v, 0) / scaleParts.length, scaleParts.map((p) => p.d).join("; "));
  else add("scale", false, 0, "plan nie podaje budżetu ani długości");

  if (params.province) {
    const same = c.province === params.province;
    add("location", true, same ? 1 : 0, same ? `to samo województwo: ${c.province}` : `inne województwo (${c.province ?? "brak"})`);
  } else add("location", false, 0, "lokalizacja planu nieokreślona (podaj województwo)");

  const totalWeight = components.filter((x) => x.applicable).reduce((a, x) => a + x.weight, 0) || 1;
  for (const x of components) x.points = x.applicable ? Math.round(((x.weight * x.value) / totalWeight) * 1000) / 10 : 0;
  const score = Math.round(components.reduce((a, x) => a + x.points, 0) * 10) / 10;
  const reasons = components
    .filter((x) => x.applicable && x.value >= 0.5)
    .sort((a, b) => b.points - a.points)
    .map((x) => x.detail);
  return { score, components, reasons };
}

export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)) * 100) / 100;
}
