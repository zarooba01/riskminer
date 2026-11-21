import type { CatalogEntry } from "@/lib/rm/types";

import type { CaseEvent, CaseRecord } from "./cases";
import { quantile, scoreCase, textSimilarity } from "./similarity";
import type { AssessmentItem, AssessmentMatch, AssessmentParams, AssessmentSummary, Distribution, ItemBasis, ItemExample, Uncertainty } from "./types";

export type MatchRow = Omit<AssessmentMatch, "id" | "assessment_id">;
export type ItemRow = Omit<AssessmentItem, "id" | "assessment_id" | "status">;

/** Minimalny wynik podobieństwa, od którego przypadek wchodzi do statystyki odchyleń. */
export const MIN_SCORE = 30;

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const fmt = (v: number | null, d = 1) => (v == null ? "—" : v.toLocaleString("pl-PL", { maximumFractionDigits: d }));
const signed = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}`);
const mln = (v: number) => `${(v / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} mln zł`;
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n).replace(/\s\S*$/, "")}…`;
};

export function distribution(values: (number | null | undefined)[]): Distribution {
  const sorted = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted.length ? round(sorted[0], 2) : null,
    max: sorted.length ? round(sorted[sorted.length - 1], 2) : null,
  };
}

export const uncertaintyOf = (n: number): Uncertainty => (n < 5 ? "duża" : n < 10 ? "średnia" : "umiarkowana");

/** Fragmenty opisu planu, które ekspert zwykle chce widzieć na etapie koncepcji (poradnik ekspercki MFiPR). */
const descriptionGaps: { key: string; re: RegExp; title: string; body: string; code?: string }[] = [
  { key: "connection", re: /włącz|operator|przepustow|oczyszczal|zasilan/i, title: "Miejsce włączenia do istniejącej sieci i stanowisko operatora", body: "Opis nie wskazuje punktu włączenia ani potwierdzenia operatora (przepustowość sieci / oczyszczalni). To warunek wykonalności i częsta przyczyna zmian projektu.", code: "R04" },
  { key: "land", re: /grunt|działk|właściciel|drog|służebn|teren/i, title: "Prawa do terenu na trasie sieci", body: "Opis nie mówi, czy trasa biegnie po gruntach gminnych, w pasie drogowym czy po działkach prywatnych. Brak zgód właścicieli opóźnia rozpoczęcie robót.", code: "R03" },
  { key: "permits", re: /pozwoleni|zgłoszeni|decyzj|środowisk|projekt budowlan|dokumentacj|pfu|zaprojektuj/i, title: "Stan dokumentacji i decyzji (projekt, pozwolenie, decyzja środowiskowa)", body: "Nie wiadomo, czy jest dokumentacja projektowa i pozwolenie na budowę, czy przetarg będzie w formule „zaprojektuj i wybuduj”. To zmienia podział ryzyk i realny termin.", code: "R04" },
  { key: "users", re: /przyłącz|mieszkańc|odbiorc|budynk|nieruchomo|rlm/i, title: "Liczba przyłączy i odbiorców", body: "Opis nie podaje liczby przyłączy ani odbiorców. Od niej zależy efekt projektu (wskaźniki dofinansowania) i zakres robót.", code: "R15" },
  { key: "ground", re: /geotechn|grunt|wody gruntow|podmok/i, title: "Warunki gruntowo-wodne", body: "Brak informacji o rozpoznaniu geotechnicznym. W podobnych umowach nieprzewidziane warunki gruntowe prowadziły do robót dodatkowych.", code: "R02" },
];

type ComputeInput = { params: AssessmentParams; text: string; cases: CaseRecord[]; catalog: CatalogEntry[]; detected: { code: string; terms: string[] }[] };

/**
 * Cała ocena bez AI (koszt 0, wynik powtarzalny): podobne przypadki z wyjaśnieniem, statystyka odchyleń z liczebnością
 * i niepewnością, ryzyka z przypadków (z cytatami ze źródeł), wiedza ekspercka z katalogu, flagi i braki w opisie.
 */
export function computeAssessment({ params, text, cases, catalog, detected }: ComputeInput): { matches: MatchRow[]; summary: AssessmentSummary; items: ItemRow[] } {
  const sims = textSimilarity(text, cases.map((c) => c.text));
  const scored = cases
    .map((c, i) => ({ c, ...scoreCase(params, { project_id: c.project.id, subsector_main: c.project.subsector_main, subsectors_extra: c.project.subsectors_extra ?? [], works_type: c.project.works_type, province: c.project.province, value: c.value ?? c.project.project_value, length_m: c.length_m }, sims[i]), shared: sims[i].shared }))
    .sort((a, b) => b.score - a.score || a.c.project.id.localeCompare(b.c.project.id));
  // Próba do statystyki: top_k najbardziej podobnych przypadków z potwierdzonymi liczbami. Przypadki wyżej w rankingu,
  // ale bez danych (np. dopasowanie do BZP czeka na eksperta), pokazujemy z powodem pominięcia — nie zabierają miejsca w próbie.
  const reasonOf = (s: (typeof scored)[number]) =>
    !s.c.accepted
      ? "Brak dopasowania."
      : s.c.cost_deviation_pct == null && s.c.delay_days == null
        ? "Brak danych o wykonaniu umowy (koszt i termin)."
        : s.score < MIN_SCORE
          ? `Niskie podobieństwo (< ${MIN_SCORE}).`
          : null;
  const top: typeof scored = [];
  let eligible = 0;
  for (const s of scored) {
    if (eligible >= params.top_k) break;
    if (!reasonOf(s)) eligible++;
    else if (s.score < MIN_SCORE) continue;
    top.push(s);
  }

  const matches: MatchRow[] = top.map((s, i) => {
    const { c } = s;
    const hasNumbers = c.cost_deviation_pct != null || c.delay_days != null;
    const excluded_reason = reasonOf(s);
    const complete = c.cost_deviation_pct != null && c.delay_days != null;
    return {
      project_id: c.project.id,
      rank: i + 1,
      score: s.score,
      components: s.components,
      reasons: s.reasons,
      shared_terms: s.shared,
      comparability: s.score >= 70 && complete ? "wysoka" : s.score >= 50 && hasNumbers ? "średnia" : "niska",
      included: !excluded_reason,
      excluded_reason,
      initial_value: c.value,
      paid_total: c.paid,
      cost_deviation_pct: c.cost_deviation_pct,
      initial_months: c.months,
      delay_days: c.delay_days,
      offers_count: c.offers,
    };
  });

  const included = top.filter((_, i) => matches[i].included).map((s) => s.c);
  const N = included.length;
  const { summary, flags } = summarizeSample(params, included, cases.length, top.length, detected);
  const items: ItemRow[] = [...flags];
  let sort = items.length;
  const push = (row: Omit<ItemRow, "sort">) => items.push({ ...row, sort: sort++ });
  const catalogByCode = new Map(catalog.map((c) => [c.code, c]));

  // Ryzyka z udokumentowanych zdarzeń w podobnych przypadkach + ryzyka wskazane przez opis planu.
  const byCode = new Map<string, CaseEvent[]>();
  for (const c of included) for (const e of c.events) byCode.set(e.risk_code, [...(byCode.get(e.risk_code) ?? []), e]);
  const detectedByCode = new Map(detected.map((d) => [d.code, d.terms]));
  const codes = [...new Set([...byCode.keys(), ...detectedByCode.keys()])]
    .map((code) => ({ code, cases: new Set((byCode.get(code) ?? []).map((e) => e.project_id)).size, detected: detectedByCode.has(code) }))
    .sort((a, b) => b.cases + (b.detected ? 2 : 0) - (a.cases + (a.detected ? 2 : 0)) || a.code.localeCompare(b.code))
    .filter((x, i) => x.detected || i < 6);

  for (const { code } of codes) {
    const events = byCode.get(code) ?? [];
    const entry = catalogByCode.get(code);
    const name = entry?.name ?? code;
    const caseIds = [...new Set(events.map((e) => e.project_id))];
    const perCase = (pick: (e: CaseEvent) => number | null) =>
      caseIds.map((id) => Math.max(0, ...events.filter((e) => e.project_id === id).map((e) => Number(pick(e) ?? 0)))).filter((v) => v > 0);
    const costs = perCase((e) => e.cost_pln);
    const delays = perCase((e) => e.delay_days);
    const causes = [...new Set(events.map((e) => e.cause).filter((c): c is string => Boolean(c && !/^brak danych/i.test(c))).map((c) => clip(c, 140)))].slice(0, 3);
    const examples: ItemExample[] = [...events]
      .filter((e) => e.quote && e.source_id)
      .sort((a, b) => Number(b.status === "accepted") - Number(a.status === "accepted") || Number(b.quote_verified) - Number(a.quote_verified))
      .filter((e, i, all) => all.findIndex((x) => x.project_id === e.project_id) === i)
      .slice(0, 3)
      .map((e) => ({ project_id: e.project_id, event_id: e.id, source_id: e.source_id, quote: clip(e.quote ?? "", 300), label: e.title }));
    const terms = detectedByCode.get(code) ?? [];
    // Krótko: skutki i przyczyny ze źródeł. Liczebność (w ilu z N umów) pokazuje nagłówek karty ryzyka.
    const parts = [
      costs.length ? `Wzrost kosztu: mediana ${mln(quantile([...costs].sort((a, b) => a - b), 0.5)!)} (maks. ${mln(Math.max(...costs))}).` : null,
      delays.length ? `Opóźnienie: mediana ${fmt(quantile([...delays].sort((a, b) => a - b), 0.5), 0)} dni (maks. ${Math.max(...delays)}).` : null,
      causes.length ? `Przyczyny: ${causes.slice(0, 2).map((c) => clip(c, 110)).join(" · ")}` : null,
      !caseIds.length ? `W podobnych umowach nie było udokumentowanych zdarzeń tego typu — wskazane w opisie planu („${terms.join("”, „")}”).` : null,
      !costs.length && !delays.length && !causes.length && caseIds.length && entry?.effects ? `Typowe skutki: ${entry.effects}` : null,
    ].filter(Boolean);
    const basis: ItemBasis = events.length ? "source" : "input";
    push({
      item_key: `risk:${code}`,
      kind: "risk",
      risk_code: code,
      title: `${code} ${name}`,
      body: parts.join(" "),
      basis,
      support: { project_ids: caseIds, event_ids: events.map((e) => e.id), examples, terms },
      n_cases: caseIds.length,
      n_total: N,
    });

    const why = caseIds.length ? `wystąpiło w ${caseIds.length} z ${N} podobnych umów` : `wskazane w opisie („${terms.join("”, „")}”)`;
    const guidance: [keyof Pick<CatalogEntry, "checks" | "actions" | "clauses">, ItemRow["kind"]][] = [
      ["checks", "check"],
      ["actions", "action"],
      ["clauses", "clause"],
    ];
    for (const [field, kind] of guidance) {
      (entry?.[field] ?? []).forEach((textItem, i) =>
        push({
          item_key: `${kind}:${code}:${i}`,
          kind,
          risk_code: code,
          title: textItem,
          body: `Katalog ekspercki, ${code} ${name} — ${why}.`,
          basis: "expert",
          support: { project_ids: caseIds, terms },
          // Liczebność pokazuje nagłówek ryzyka — przy zaleceniu z katalogu byłaby myląca (zalecenie nie „wystąpiło”).
          n_cases: null,
          n_total: null,
        }),
      );
    }
    // Działania zaradcze zapisane przy zdarzeniach w podobnych przypadkach (zatwierdzone przez eksperta mają pierwszeństwo).
    const mitigations = [...events]
      .filter((e) => e.mitigation && e.mitigation.length > 15)
      .sort((a, b) => Number(b.status === "accepted") - Number(a.status === "accepted"))
      .filter((e, i, all) => all.findIndex((x) => x.mitigation === e.mitigation) === i)
      .slice(0, 2);
    mitigations.forEach((e) =>
      push({
        item_key: `action:${code}:event:${e.id}`,
        kind: "action",
        risk_code: code,
        title: clip(e.mitigation!, 300),
        body: `Zalecenie przy zdarzeniu „${clip(e.title, 100)}” (${e.project_id}).`,
        basis: e.status === "accepted" ? "expert" : e.origin === "llm" ? "llm" : "source",
        support: { project_ids: [e.project_id], event_ids: [e.id], examples: e.quote && e.source_id ? [{ project_id: e.project_id, event_id: e.id, source_id: e.source_id, quote: clip(e.quote, 300) }] : [] },
        n_cases: 1,
        n_total: N,
      }),
    );
  }

  // Braki w opisie planu (parametry i kwestie z poradnika eksperckiego).
  const missing: [string, string, string][] = [];
  if (!params.subsector_main) missing.push(["subsector", "Rodzaj infrastruktury", "Nie rozpoznano podsektora — wskaż go w założeniach, żeby dobrać właściwe przypadki."]);
  if (!params.length_m) missing.push(["length", "Długość sieci", "Bez długości nie da się porównać skali ani kosztu 1 km z podobnymi umowami."]);
  if (!params.budget_pln) missing.push(["budget", "Planowany budżet", "Bez budżetu nie policzymy prognozowanego przedziału kosztu."]);
  if (!params.duration_months) missing.push(["duration", "Planowany czas realizacji", "Bez terminu nie porównamy harmonogramu z podobnymi umowami."]);
  if (!params.province) missing.push(["province", "Województwo", "Lokalizacja nie wpływa na dobór przypadków, dopóki nie podasz województwa."]);
  for (const [key, title, body] of missing) push({ item_key: `gap:${key}`, kind: "gap", risk_code: null, title, body, basis: "input", support: {}, n_cases: null, n_total: null });
  const fullText = `${text} ${params.local_conditions ?? ""}`;
  for (const gap of descriptionGaps) {
    if (gap.re.test(fullText)) continue;
    push({ item_key: `gap:${gap.key}`, kind: "gap", risk_code: gap.code ?? null, title: gap.title, body: gap.body, basis: "expert", support: {}, n_cases: null, n_total: null });
  }

  return { matches, summary, items };
}

/**
 * Liczby z danych dla wybranej próby (wspólne dla oceny deterministycznej i oceny AI): rozkłady odchyleń z liczebnością,
 * niepewność, prognoza dla budżetu i terminu oraz czerwone flagi (progi na statystyce). Bez AI.
 */
export function summarizeSample(params: AssessmentParams, included: CaseRecord[], corpus: number, considered: number, detected: AssessmentSummary["detected"]): { summary: AssessmentSummary; flags: ItemRow[] } {
  const N = included.length;
  const cost = distribution(included.map((c) => c.cost_deviation_pct));
  const delayDays = distribution(included.map((c) => c.delay_days));
  const delayPct = distribution(included.map((c) => (c.delay_days != null && c.months ? round((c.delay_days / (c.months * 30.44)) * 100) : null)));
  const months = distribution(included.map((c) => c.months));
  const costPerKm = distribution(included.map((c) => (c.length_m && (c.paid ?? c.value) ? round(((c.paid ?? c.value)! / c.length_m) * 1000, 0) : null)));
  const uncertainty = uncertaintyOf(cost.n);

  const forecastCost = params.budget_pln && cost.n >= 3 && cost.p25 != null && cost.median != null && cost.p75 != null
    ? { low: Math.round(params.budget_pln * (1 + cost.p25 / 100)), mid: Math.round(params.budget_pln * (1 + cost.median / 100)), high: Math.round(params.budget_pln * (1 + cost.p75 / 100)) }
    : null;
  const forecastMonths = params.duration_months && delayPct.n >= 3 && delayPct.p25 != null && delayPct.median != null && delayPct.p75 != null
    ? { low: round(params.duration_months * (1 + delayPct.p25 / 100)), mid: round(params.duration_months * (1 + delayPct.median / 100)), high: round(params.duration_months * (1 + delayPct.p75 / 100)) }
    : null;
  const byLength = params.length_m && costPerKm.n >= 2 && costPerKm.median ? Math.round((costPerKm.median * params.length_m) / 1000) : null;
  const note =
    N < 3
      ? `Za mało porównywalnych przypadków (${N}) — przedziałów nie podajemy. Uzupełnij bazę albo zmień założenia.`
      : `Przedziały to kwartyle (P25–P75) z ${cost.n} umów; niepewność ${uncertainty}. To dane historyczne, nie gwarancja — skład próby widać w zakładce „Podobne inwestycje”.`;

  const summary: AssessmentSummary = {
    generated_at: new Date().toISOString(),
    corpus,
    considered,
    included: N,
    cost,
    delay_days: delayDays,
    delay_pct: delayPct,
    months,
    offers: distribution(included.map((c) => c.offers)),
    value: distribution(included.map((c) => c.value)),
    cost_per_km: costPerKm,
    share_cost_increase: { k: included.filter((c) => (c.cost_deviation_pct ?? 0) > 0).length, n: included.filter((c) => c.cost_deviation_pct != null).length },
    share_delayed: { k: included.filter((c) => (c.delay_days ?? 0) > 0).length, n: included.filter((c) => c.delay_days != null).length },
    share_changed: { k: included.filter((c) => c.value_changes + c.term_changes > 0).length, n: N },
    uncertainty,
    forecast: { cost: forecastCost, months: forecastMonths, by_length: byLength, note },
    detected,
  };

  const items: ItemRow[] = [];
  let sort = 0;
  const push = (row: Omit<ItemRow, "sort">) => items.push({ ...row, sort: sort++ });

  // Flagi — wyłącznie obliczenia na przypadkach (z liczebnością).
  if (cost.n >= 3 && cost.median != null) {
    const { k, n } = summary.share_cost_increase;
    push({
      item_key: "flag:cost",
      kind: "flag",
      risk_code: "R07",
      title: `Koszt rósł w ${k} z ${n} podobnych umów (mediana ${signed(cost.median)}%, P25–P75 ${signed(cost.p25)}…${signed(cost.p75)}%)`,
      body: `Odchylenie: wypłata względem wartości umowy z ogłoszeń o wykonaniu umowy. Zakres: ${signed(cost.min)}…${signed(cost.max)}%.${(cost.p75 ?? 0) > 10 ? " Górny kwartyl powyżej 10% — warto przewidzieć rezerwę budżetową." : ""}`,
      basis: "calc",
      support: { project_ids: included.filter((c) => c.cost_deviation_pct != null).map((c) => c.project.id) },
      n_cases: k,
      n_total: n,
    });
  }
  if (delayDays.n >= 3 && delayDays.median != null) {
    const { k, n } = summary.share_delayed;
    push({
      item_key: "flag:delay",
      kind: "flag",
      risk_code: "R06",
      title: `${k} z ${n} podobnych umów zakończono po pierwotnym terminie (mediana ${signed(delayDays.median)} dni)`,
      body: `Opóźnienie względem terminu z umowy (data zawarcia + okres realizacji). Względem pierwotnego czasu realizacji: mediana ${signed(delayPct.median)}%, P25–P75 ${signed(delayPct.p25)}…${signed(delayPct.p75)}%.`,
      basis: "calc",
      support: { project_ids: included.filter((c) => c.delay_days != null).map((c) => c.project.id) },
      n_cases: k,
      n_total: n,
    });
  }
  if (summary.share_changed.n >= 3 && summary.share_changed.k > 0) {
    push({
      item_key: "flag:changes",
      kind: "flag",
      risk_code: "R07",
      title: `Aneksy (kwota lub termin) w ${summary.share_changed.k} z ${summary.share_changed.n} podobnych umów`,
      body: "Zmiany umów odczytane z ogłoszeń o zmianie i o wykonaniu umowy w BZP.",
      basis: "calc",
      support: { project_ids: included.filter((c) => c.value_changes + c.term_changes > 0).map((c) => c.project.id) },
      n_cases: summary.share_changed.k,
      n_total: summary.share_changed.n,
    });
  }
  const offers = summary.offers;
  if (offers.n >= 3 && offers.median != null && offers.median <= 3) {
    push({
      item_key: "flag:competition",
      kind: "flag",
      risk_code: "R11",
      title: `Słaba konkurencja: mediana ${fmt(offers.median, 0)} ofert w podobnych postępowaniach`,
      body: `Liczba ofert z ogłoszeń o wyniku postępowania (min. ${fmt(offers.min, 0)}, maks. ${fmt(offers.max, 0)}).`,
      basis: "calc",
      support: { project_ids: included.filter((c) => c.offers != null).map((c) => c.project.id) },
      n_cases: included.filter((c) => (c.offers ?? 99) <= 3).length,
      n_total: offers.n,
    });
  }
  if (params.budget_pln && summary.value.n >= 3 && summary.value.median) {
    const ratio = params.budget_pln / summary.value.median;
    if (ratio < 0.5 || ratio > 2) {
      push({
        item_key: "flag:scale",
        kind: "flag",
        risk_code: null,
        title: `Budżet ${mln(params.budget_pln)} ${ratio < 0.5 ? "znacznie niższy" : "znacznie wyższy"} niż mediana wartości podobnych umów (${mln(summary.value.median)})`,
        body: "Sprawdź, czy zakres jest porównywalny — przy innej skali odchylenia procentowe mogą się różnić.",
        basis: "calc",
        support: { project_ids: included.map((c) => c.project.id) },
        n_cases: null,
        n_total: summary.value.n,
      });
    }
  }
  if (byLength && params.budget_pln && byLength > params.budget_pln * 1.15) {
    push({
      item_key: "flag:per-km",
      kind: "flag",
      risk_code: "R13",
      title: `Budżet może być niedoszacowany: koszt 1 km w podobnych umowach to mediana ${mln(costPerKm.median!)}, czyli ok. ${mln(byLength)} dla planowanej długości`,
      body: `Obliczenie z ${costPerKm.n} umów, dla których znana jest długość sieci (z opisu przedmiotu zamówienia).`,
      basis: "calc",
      support: { project_ids: included.filter((c) => c.length_m).map((c) => c.project.id) },
      n_cases: null,
      n_total: costPerKm.n,
    });
  }
  if (params.duration_months && months.n >= 3 && months.median && params.duration_months < months.median * 0.8) {
    push({
      item_key: "flag:duration",
      kind: "flag",
      risk_code: "R06",
      title: `Planowany czas (${fmt(params.duration_months, 0)} mies.) krótszy niż w podobnych umowach (mediana ${fmt(months.median)} mies.)`,
      body: "Porównanie z pierwotnym okresem realizacji z ogłoszeń. Przy krótszym terminie rośnie ryzyko aneksów terminowych.",
      basis: "calc",
      support: { project_ids: included.filter((c) => c.months).map((c) => c.project.id) },
      n_cases: null,
      n_total: months.n,
    });
  }

  return { summary, flags: items };
}
