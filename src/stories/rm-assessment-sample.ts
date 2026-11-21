import type { AssessmentDetail, AssessmentListItem } from "@/lib/assess/queries";
import type { AssessmentItem, AssessmentMatch, AssessmentSummary, MatchComponent } from "@/lib/assess/types";
import { defaultWeights } from "@/lib/assess/types";

/** Przykładowa ocena (Góraszka) do historii Storybooka — statystyka z rzeczywistego przeliczenia na bazie demo. */
const now = "2026-11-21T12:00:00Z";
const id = "00000000-0000-4000-8000-000000000001";

const summary = {"cost": {"n": 8, "max": 21.68, "min": -45.03, "p25": 3.13, "p75": 7.19, "median": 5.88}, "value": {"n": 8, "max": 5991655.95, "min": 1193100, "p25": 2068541.43, "p75": 5014833, "median": 3276105}, "corpus": 23, "months": {"n": 8, "max": 27, "min": 1.2, "p25": 3.08, "p75": 13, "median": 7.65}, "offers": {"n": 8, "max": 12, "min": 3, "p25": 4.75, "p75": 9, "median": 6.5}, "detected": [{"code": "R03", "terms": ["kolizje", "uzbrojeniem", "zarządcą"]}, {"code": "R04", "terms": ["uzgodnienia", "włączenie"]}], "forecast": {"cost": {"low": 4125200, "mid": 4235200, "high": 4287600}, "note": "Przedziały to kwartyle (P25–P75) z 8 umów; niepewność średnia. To dane historyczne, nie gwarancja — skład próby widać w zakładce „Podobne inwestycje”.", "months": {"low": 12.7, "mid": 14.6, "high": 16}, "by_length": 2411226}, "included": 8, "previous": null, "delay_pct": {"n": 8, "max": 112.2, "min": 0, "p25": 5.75, "p75": 33.35, "median": 21.7}, "considered": 14, "delay_days": {"n": 8, "max": 77, "min": 0, "p25": 31, "p75": 59, "median": 38.5}, "cost_per_km": {"n": 4, "max": 1566108, "min": 224057, "p25": 449364.5, "p75": 1203789.75, "median": 803742}, "uncertainty": "średnia", "generated_at": "2026-11-21T12:00:00Z", "share_changed": {"k": 8, "n": 8}, "share_delayed": {"k": 7, "n": 8}, "share_cost_increase": {"k": 7, "n": 8}} as AssessmentSummary;

const components = (scope: number, scale: number): MatchComponent[] => [
  { feature: "subsector", label: "Podsektor (rodzaj infrastruktury)", weight: 35, value: 1, points: 38.9, detail: "ten sam podsektor: Kanalizacja sanitarna", applicable: true },
  { feature: "works", label: "Rodzaj robót (budowa / przebudowa)", weight: 15, value: 1, points: 16.7, detail: "ten sam rodzaj robót: budowa/rozbudowa", applicable: true },
  { feature: "scope", label: "Zakres — treść opisów", weight: 25, value: scope, points: Math.round(scope * 278) / 10, detail: "wspólne pojęcia: włączenie, zarządcą, uzbrojeniem, kanalizację", applicable: true },
  { feature: "scale", label: "Skala (budżet, długość sieci)", weight: 15, value: scale, points: Math.round(scale * 167) / 10, detail: "wartość umowy 2,11 mln zł vs budżet 4 mln zł; długość 2,07 km vs 3 km", applicable: true },
  { feature: "location", label: "Lokalizacja (województwo)", weight: 10, value: 0, points: 0, detail: "inne województwo (dolnośląskie)", applicable: true },
];

const match = (rank: number, project_id: string, title: string, score: number, extra: Partial<AssessmentMatch> = {}): AssessmentDetail["matches"][number] => ({
  id: `m-${rank}`,
  assessment_id: id,
  project_id,
  rank,
  score,
  components: components(0.6, 0.64),
  reasons: ["ten sam podsektor: Kanalizacja sanitarna", "ten sam rodzaj robót: budowa/rozbudowa", "wspólne pojęcia: włączenie, zarządcą, kanalizację"],
  shared_terms: ["włączenie", "zarządcą", "kanalizację"],
  comparability: score >= 70 ? "wysoka" : "średnia",
  included: true,
  excluded_reason: null,
  initial_value: 2107348.39,
  paid_total: 2246177.66,
  cost_deviation_pct: 6.59,
  initial_months: 12,
  delay_days: 77,
  offers_count: 4,
  ...extra,
  project: { id: project_id, title, beneficiary_name: "Gmina", city: null, province: "mazowieckie", subsector_main: "Kanalizacja sanitarna", works_type: "budowa/rozbudowa", notice_source_id: null },
});

const item = (sort: number, partial: Partial<AssessmentItem> & Pick<AssessmentItem, "kind" | "title" | "basis">): AssessmentItem => ({
  id: `i-${sort}`,
  assessment_id: id,
  item_key: `${partial.kind}:${sort}`,
  risk_code: null,
  body: null,
  support: {},
  n_cases: null,
  n_total: null,
  status: "proposed",
  sort,
  ...partial,
});

export const sampleAssessment: AssessmentDetail = {
  assessment: {
    id,
    title: "Kanalizacja sanitarna w Góraszce",
    description: "Chcemy wybudować kanalizację sanitarną w Góraszce (gmina Wiązowna). Około 3 km sieci, budżet 4 mln zł, 12 miesięcy.",
    params: { subsector_main: "Kanalizacja sanitarna", subsectors_extra: [], works_type: "budowa/rozbudowa", province: "mazowieckie", length_m: 3000, budget_pln: 4000000, duration_months: 12, local_conditions: "Włączenie do istniejącej sieci, uzgodnienia z zarządcą drogi, kolizje z uzbrojeniem.", weights: defaultWeights, top_k: 8 },
    params_origin: { subsector_main: "rule", works_type: "rule", province: "input", length_m: "input", budget_pln: "input", duration_months: "input", local_conditions: "input" },
    document_source_ids: [],
    summary,
    version: 2,
    llm_run_id: null,
    mode: "deterministic",
    created_at: now,
    updated_at: now,
  },
  matches: [
    match(1, "RM-2026-001", "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice", 84),
    match(2, "RM-2026-017", "Budowa sieci kanalizacji sanitarnej wraz z przyłączami w miejscowości Tanibórz", 78, { included: false, excluded_reason: "Brak dopasowania.", comparability: "średnia", cost_deviation_pct: null, delay_days: null, paid_total: null }),
    match(3, "RM-2026-012", "Budowa tranzytu przesyłowego sieci kanalizacji sanitarnej ze Smętowa do Kos", 74, { cost_deviation_pct: 0.96, delay_days: 56, initial_value: 3616200, paid_total: 3650944.36, initial_months: 5.3, offers_count: 7 }),
    match(4, "RM-2026-013", "Budowa sieci kanalizacji sanitarnej w Gminie Bestwina – sołectwo Kaniów", 70, { cost_deviation_pct: 6.77, delay_days: 31, initial_value: 5991655.95, paid_total: 6397551.35, initial_months: 16, offers_count: 9 }),
  ],
  items: [
    item(0, { kind: "flag", basis: "calc", risk_code: "R07", title: "Koszt rósł w 7 z 8 podobnych umów (mediana +5,9%, P25–P75 +3,1…+7,2%)", n_cases: 7, n_total: 8, support: { project_ids: ["RM-2026-001", "RM-2026-012"] } }),
    item(1, { kind: "flag", basis: "calc", risk_code: "R06", title: "7 z 8 podobnych umów zakończono po pierwotnym terminie (mediana +39 dni)", n_cases: 7, n_total: 8 }),
    item(2, { kind: "risk", basis: "source", risk_code: "R07", title: "R07 Nieprzewidziane zmiany i roboty dodatkowe", body: "Udokumentowane w 8 z 8 podobnych umów.", n_cases: 8, n_total: 8, support: { project_ids: ["RM-2026-001"], examples: [{ project_id: "RM-2026-001", source_id: null, quote: "konieczność wykonania robót dodatkowych", label: "Zmiana umowy nr 1" }] } }),
    item(3, { kind: "check", basis: "expert", risk_code: "R07", title: "Czy budżet przewiduje rezerwę na nieprzewidziane roboty?" }),
    item(4, { kind: "clause", basis: "expert", risk_code: "R07", title: "Klauzula zmian przewidzianych (art. 455 ust. 1 pkt 1 Pzp) z opisem rodzajów zmian i sposobu wyceny." }),
    item(5, { kind: "risk", basis: "input", risk_code: "R03", title: "R03 Kolizje, dostęp do terenu i prawa do nieruchomości", body: "Wskazane w opisie planu: „kolizje”, „zarządcą” — wymaga lokalnego potwierdzenia.", n_cases: 0, n_total: 8 }),
    item(6, { kind: "check", basis: "expert", risk_code: "R03", title: "Czy rozpoznano kolizje z innymi sieciami i są warunki usunięcia kolizji od gestorów?", status: "accepted" }),
    item(7, { kind: "action", basis: "llm", risk_code: "R03", title: "Uzgodnić z zarządcą drogi powiatowej zakres odtworzenia nawierzchni przed przetargiem.", n_cases: 1, n_total: 8, item_key: "ai:sample" }),
    item(8, { kind: "gap", basis: "expert", risk_code: "R15", title: "Liczba przyłączy i odbiorców", body: "Opis nie podaje liczby przyłączy ani odbiorców." }),
  ],
  sources: {},
  documents: [],
  catalog: [
    { code: "R03", name: "Kolizje, dostęp do terenu i prawa do nieruchomości" },
    { code: "R06", name: "Nierealistyczny harmonogram i nieuwzględnione zależności" },
    { code: "R07", name: "Nieprzewidziane zmiany i roboty dodatkowe" },
  ],
};

export const sampleAssessments: AssessmentListItem[] = [
  {
    id,
    title: sampleAssessment.assessment.title,
    description: sampleAssessment.assessment.description,
    version: 2,
    created_at: now,
    updated_at: now,
    llm_run_id: null,
    mode: "deterministic",
    params: { subsector_main: "Kanalizacja sanitarna", province: "mazowieckie", budget_pln: 4000000, length_m: 3000 },
    summary: { included: summary.included, uncertainty: summary.uncertainty, cost: summary.cost, delay_days: summary.delay_days },
    items: 9,
  },
];
