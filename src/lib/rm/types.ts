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
  source_id: string;
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
