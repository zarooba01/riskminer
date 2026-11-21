/** Typy oceny nowej inwestycji (tabele rm_assessments, rm_assessment_matches, rm_assessment_items). */
import type { Status } from "@/lib/rm/types";

export type Weights = { subsector: number; works: number; scope: number; scale: number; location: number };

export const defaultWeights: Weights = { subsector: 35, works: 15, scope: 25, scale: 15, location: 10 };

export const weightLabels: Record<keyof Weights, string> = {
  subsector: "Podsektor (rodzaj infrastruktury)",
  works: "Rodzaj robót (budowa / przebudowa)",
  scope: "Zakres — treść opisów",
  scale: "Skala (budżet, długość sieci)",
  location: "Lokalizacja (województwo)",
};

export type AssessmentParams = {
  subsector_main: string | null;
  subsectors_extra: string[];
  works_type: string | null;
  province: string | null;
  length_m: number | null;
  budget_pln: number | null;
  duration_months: number | null;
  local_conditions: string | null;
  weights: Weights;
  top_k: number;
};

/** Pochodzenie parametru: wpisany przez użytkownika, odczytany regułą z opisu, zaproponowany przez model. */
export type ParamOrigin = "input" | "rule" | "llm";
export type ParamKey = "subsector_main" | "works_type" | "province" | "length_m" | "budget_pln" | "duration_months" | "local_conditions";

export type Distribution = { n: number; median: number | null; p25: number | null; p75: number | null; min: number | null; max: number | null };

export type Uncertainty = "duża" | "średnia" | "umiarkowana";

export type AssessmentSummary = {
  generated_at: string;
  /** Liczba zakończonych inwestycji w bazie, spośród których dobierano przypadki. */
  corpus: number;
  /** Ile przypadków pokazano (top_k) i ile z nich weszło do statystyki. */
  considered: number;
  included: number;
  cost: Distribution;
  delay_days: Distribution;
  delay_pct: Distribution;
  months: Distribution;
  offers: Distribution;
  value: Distribution;
  cost_per_km: Distribution;
  share_cost_increase: { k: number; n: number };
  share_delayed: { k: number; n: number };
  share_changed: { k: number; n: number };
  uncertainty: Uncertainty;
  forecast: {
    cost: { low: number; mid: number; high: number } | null;
    months: { low: number; mid: number; high: number } | null;
    by_length: number | null;
    note: string;
  };
  /** Kody ryzyk wskazane przez opis / warunki lokalne, z frazami, które je wywołały. */
  detected: { code: string; terms: string[] }[];
  previous?: PreviousSummary | null;
};

export type PreviousSummary = {
  version: number;
  generated_at: string;
  included: number;
  cost: Distribution;
  delay_days: Distribution;
  project_ids: string[];
  risk_codes: string[];
};

export type Assessment = {
  id: string;
  title: string;
  description: string;
  params: AssessmentParams;
  params_origin: Partial<Record<ParamKey, ParamOrigin>>;
  document_source_ids: string[];
  summary: AssessmentSummary | Record<string, never>;
  version: number;
  llm_run_id: string | null;
  /** deterministic — reguły i obliczenia; ai — model dobiera przypadki i formułuje wnioski (liczby z danych). */
  mode: AssessmentMode;
  created_at: string;
  updated_at: string;
};

export type AssessmentMode = "deterministic" | "ai";

export type MatchComponent = { feature: keyof Weights; label: string; weight: number; value: number; points: number; detail: string; applicable: boolean };

export type AssessmentMatch = {
  id: string;
  assessment_id: string;
  project_id: string;
  rank: number;
  score: number;
  components: MatchComponent[];
  reasons: string[];
  shared_terms: string[];
  comparability: "wysoka" | "średnia" | "niska";
  included: boolean;
  excluded_reason: string | null;
  initial_value: number | null;
  paid_total: number | null;
  cost_deviation_pct: number | null;
  initial_months: number | null;
  delay_days: number | null;
  offers_count: number | null;
};

export type ItemKind = "risk" | "check" | "action" | "clause" | "flag" | "gap";
export type ItemBasis = "calc" | "source" | "expert" | "input" | "llm";

export type ItemExample = { project_id: string; event_id?: string | null; source_id: string | null; quote: string | null; label?: string | null };

export type AssessmentItem = {
  id: string;
  assessment_id: string;
  item_key: string;
  kind: ItemKind;
  risk_code: string | null;
  title: string;
  body: string | null;
  basis: ItemBasis;
  support: { project_ids?: string[]; event_ids?: string[]; examples?: ItemExample[]; terms?: string[] };
  n_cases: number | null;
  n_total: number | null;
  status: Status;
  sort: number;
};

export const itemKindLabels: Record<ItemKind, string> = {
  risk: "Ryzyko",
  check: "Do sprawdzenia przed przetargiem",
  action: "Działanie do rozważenia",
  clause: "Zapis umowny",
  flag: "Flaga",
  gap: "Brak w opisie",
};

export const subsectorOptions = [
  "Kanalizacja sanitarna",
  "Sieć wodociągowa",
  "Oczyszczalnia ścieków",
  "Uzdatnianie i zaopatrzenie w wodę",
  "Kanalizacja deszczowa i retencja",
  "Inne obiekty wod-kan",
];

export const worksTypeOptions = ["budowa/rozbudowa", "przebudowa/modernizacja"];

export const provinceOptions = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

export const paramLabels: Record<ParamKey, string> = {
  subsector_main: "Podsektor główny",
  works_type: "Rodzaj robót",
  province: "Województwo",
  length_m: "Długość sieci",
  budget_pln: "Planowany budżet (brutto)",
  duration_months: "Planowany czas realizacji",
  local_conditions: "Znane warunki lokalne",
};
