import type { ParsedNotice } from "./notice-parse";

/** Typy rekordów bazy Risk Miner (tabele rm_*). */
export type Status = "proposed" | "accepted" | "rejected";

export type Project = {
  id: string;
  beneficiary_name: string;
  beneficiary_nip: string | null;
  province_code: string | null;
  province: string | null;
  city: string | null;
  title: string;
  record_scope: string | null;
  public_id_type: string | null;
  public_id: string | null;
  status: string | null;
  annotation: string | null;
  project_value: number | null;
  co_financing: number | null;
  subsector_main: string | null;
  subsectors_extra: string[];
  works_type: string | null;
  source_id: string | null;
  enriched_at: string | null;
  enrichment_log: { at: string; step: string; detail: string; url?: string; count?: number }[];
};

export type Source = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  external_id: string | null;
  fetched_at: string;
};

export type Procurement = {
  id: string;
  project_id: string;
  ocid: string;
  bzp_number: string | null;
  title: string | null;
  buyer_name: string | null;
  buyer_nip: string | null;
  cpv: string | null;
  match_method: string;
  match_confidence: number;
  match_basis: string[];
  status: Status;
};

export type Notice = {
  id: string;
  procurement_id: string;
  notice_type: string;
  notice_number: string;
  published_at: string | null;
  title: string | null;
  source_id: string;
  /** Pola wyciągnięte z formularza ogłoszenia (parser, bez AI). */
  parsed?: ParsedNotice;
};

export type Contract = {
  id: string;
  procurement_id: string;
  part_no: number;
  part_title: string | null;
  contractor_name: string | null;
  contractor_nip: string | null;
  signed_at: string | null;
  initial_value: number | null;
  initial_months: number | null;
  planned_end: string | null;
  actual_end: string | null;
  on_time: boolean | null;
  paid_total: number | null;
  performed_properly: boolean | null;
  offers_count: number | null;
  lowest_offer: number | null;
  highest_offer: number | null;
  cost_deviation_pct: number | null;
  delay_days: number | null;
  source_ids: string[];
};

export type ContractChange = {
  id: string;
  contract_id: string;
  change_no: number | null;
  changed_at: string | null;
  legal_basis: string | null;
  reason: string | null;
  description: string | null;
  value_change: number | null;
  price_increase: boolean | null;
  /** Nowy termin wykonania odczytany z opisu zmiany (jeśli źródło go podaje). */
  new_end_date: string | null;
  /** Główne źródło zmiany (zwykle ogłoszenie o zmianie umowy). */
  source_id: string;
  /** Inne ogłoszenia, w których występuje ta sama zmiana (np. ogłoszenie o wykonaniu umowy). */
  related_source_ids: string[];
};

export type RiskEvent = {
  id: string;
  project_id: string;
  contract_id: string | null;
  change_id: string | null;
  risk_code: string;
  title: string;
  signal: string | null;
  event: string | null;
  impact: string | null;
  cause: string | null;
  mitigation: string | null;
  delay_days: number | null;
  cost_pln: number | null;
  quote: string | null;
  source_id: string | null;
  confidence: number | null;
  origin: "rule" | "llm" | "expert";
  llm_run_id: string | null;
  quote_verified: boolean | null;
  status: Status;
  exemplary: boolean;
  /** Strona dokumentu eksperta, z której pochodzi cytat. */
  page?: number | null;
  created_at: string;
};

export type CatalogEntry = {
  code: string;
  name: string;
  effects: string | null;
  keywords: string[];
  approved: boolean;
  proposed_by: string;
};

export type LlmRun = {
  id: string;
  task: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  project_id: string | null;
  output: unknown;
  valid_schema: boolean;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_cached: number | null;
  cost_usd: number | null;
  cost_source: string | null;
  error: string | null;
  created_at: string;
};

export type Decision = {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  comment: string | null;
  actor: string;
  created_at: string;
};

/** Główne dopasowanie projektu do przetargu (do kolumny „Dopasowanie” i okna sprawdzenia). */
export type MatchInfo = {
  id: string;
  status: "accepted" | "proposed";
  bzp_number: string | null;
  title: string | null;
  buyer_name: string | null;
  buyer_nip: string | null;
  cpv: string | null;
  confidence: number;
  method: string;
  basis: string[];
  notice_url: string | null;
  published_at: string | null;
};

/** Dokument dodany przez eksperta (PDF/DOCX). */
export type ProjectDocument = {
  id: string;
  project_id: string;
  contract_id: string | null;
  source_id: string | null;
  doc_type: string;
  file_name: string;
  pages: number | null;
  chars: number | null;
  status: "processing" | "analyzed" | "error";
  summary: string | null;
  error: string | null;
  created_at: string;
  /** Tymczasowy link do pobrania oryginału (generowany po stronie serwera). */
  download_url?: string | null;
};

/** Ustalenie z dokumentu względem danych sprawy. */
export type DocumentFinding = {
  id: string;
  document_id: string;
  kind: "confirms" | "adds" | "conflicts";
  topic: string;
  statement: string;
  doc_value: string | null;
  current_value: string | null;
  quote: string | null;
  page: number | null;
  quote_verified: boolean | null;
  confidence: number | null;
  status: Status;
};

/** Zdarzenie w raporcie zmian (skrót). */
export type ReportEventRef = { id: string; title: string; risk_code: string; origin: string; status: string };
export type ReportFieldChange = { field: string; label: string; before: string | number | null; after: string | number | null };

/** Wynik porównania ustaleń przed i po ponownej analizie. */
export type ChangeReportSummary = {
  added: ReportEventRef[];
  removed: ReportEventRef[];
  changed: { event: ReportEventRef; fields: ReportFieldChange[] }[];
  unchanged: number;
  contracts: { label: string; fields: ReportFieldChange[] }[];
  changes: { before: number; after: number };
  findingsAdded: { id: string; kind: string; statement: string }[];
  /** Decyzje eksperta (zatwierdzone / odrzucone), które pozostały bez zmian. */
  decisionsKept: number;
};

export type ChangeReport = { id: string; project_id: string; trigger: string; summary: ChangeReportSummary; created_at: string };

/** Wynik sprawdzenia źródła dodatkowego (strona postępowania zamawiającego, TED). */
export type ExternalCheck = {
  id: string;
  project_id: string;
  source: "platform" | "ted";
  status: "found" | "not_found" | "error" | "skipped";
  url: string | null;
  title: string | null;
  confidence: number | null;
  basis: string[];
  details: {
    documents?: { name: string; date: string | null; url: string }[];
    documentSources?: { name: string; sourceId: string; url: string }[];
    buyerSite?: string | null;
    budget?: { amount: number; quote: string; sourceId: string; document: string } | null;
    valueConfirmed?: string | null;
  };
  source_id: string | null;
  checked_at: string;
};
