import "server-only";

import { databaseConfigured, db } from "@/lib/supabase/admin";

import type { CatalogEntry, Contract, ContractChange, Decision, Notice, Procurement, Project, RiskEvent, Source } from "./types";

export { databaseConfigured };

export type ProjectSummary = Project & {
  procurements: number;
  contract: Pick<Contract, "initial_value" | "paid_total" | "cost_deviation_pct" | "delay_days"> | null;
  events: { proposed: number; accepted: number };
};

/**
 * Odchylenie projektu: rekord „część N” → umowa tej części; całe postępowanie w częściach → suma umów
 * (koszt łączny, opóźnienie maksymalne). Obliczenie — nie dana źródłowa.
 */
export function summarizeContracts(project: Pick<Project, "record_scope">, contracts: Contract[]): ProjectSummary["contract"] {
  if (!contracts.length) return null;
  const scopePart = Number(project.record_scope?.match(/część\s*(\d+)/i)?.[1] ?? 0);
  const own = scopePart ? contracts.filter((c) => c.part_no === scopePart) : [];
  const set = own.length ? own : contracts;
  if (set.length === 1) return set[0];
  const initial = set.reduce((a, c) => a + Number(c.initial_value ?? 0), 0);
  const paidKnown = set.every((c) => c.paid_total != null);
  const paid = set.reduce((a, c) => a + Number(c.paid_total ?? 0), 0);
  const delays = set.map((c) => c.delay_days).filter((d): d is number => d != null);
  return {
    initial_value: initial || null,
    paid_total: paidKnown ? paid : null,
    cost_deviation_pct: paidKnown && initial ? Math.round(((paid - initial) / initial) * 10000) / 100 : null,
    delay_days: delays.length ? Math.max(...delays) : null,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = db();
  const [{ data: projects }, { data: procs }, { data: contracts }, { data: events }] = await Promise.all([
    supabase.from("rm_projects").select("*").order("id"),
    supabase.from("rm_procurements").select("id,project_id,status,match_confidence").order("match_confidence", { ascending: false }),
    supabase.from("rm_contracts").select("procurement_id,part_no,initial_value,paid_total,cost_deviation_pct,delay_days"),
    supabase.from("rm_risk_events").select("project_id,status"),
  ]);
  const procByProject = new Map<string, string[]>();
  for (const p of procs ?? []) if (p.status !== "rejected") procByProject.set(p.project_id, [...(procByProject.get(p.project_id) ?? []), p.id]);

  return ((projects ?? []) as Project[]).map((p) => {
    const ids = procByProject.get(p.id) ?? [];
    const contract = summarizeContracts(p, (contracts ?? []).filter((c) => c.procurement_id === ids[0]) as Contract[]);
    const own = (events ?? []).filter((e) => e.project_id === p.id);
    return {
      ...p,
      procurements: ids.length,
      contract,
      events: { proposed: own.filter((e) => e.status === "proposed").length, accepted: own.filter((e) => e.status === "accepted").length },
    };
  });
}

export type ProjectDetail = {
  project: Project;
  procurements: (Procurement & { notices: Notice[]; contracts: Contract[]; changes: ContractChange[] })[];
  events: RiskEvent[];
  sources: Record<string, Source>;
};

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const supabase = db();
  const { data: project } = await supabase.from("rm_projects").select("*").eq("id", id).maybeSingle();
  if (!project) return null;
  const { data: procs } = await supabase.from("rm_procurements").select("*").eq("project_id", id).order("match_confidence", { ascending: false });
  const procIds = (procs ?? []).map((p) => p.id as string);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: notices }, { data: contracts }, { data: events }] = await Promise.all([
    supabase.from("rm_notices").select("*").in("procurement_id", procIds.length ? procIds : none).order("published_at"),
    supabase.from("rm_contracts").select("*").in("procurement_id", procIds.length ? procIds : none),
    supabase.from("rm_risk_events").select("*").eq("project_id", id).order("created_at"),
  ]);
  const contractIds = (contracts ?? []).map((c) => c.id as string);
  const { data: changes } = await supabase.from("rm_contract_changes").select("*").in("contract_id", contractIds.length ? contractIds : none).order("change_no");

  const sourceIds = new Set<string>();
  (notices ?? []).forEach((n) => sourceIds.add(n.source_id));
  (events ?? []).forEach((e) => e.source_id && sourceIds.add(e.source_id));
  if (project.source_id) sourceIds.add(project.source_id);
  const { data: sources } = sourceIds.size
    ? await supabase.from("rm_sources").select("id,kind,title,url,external_id,fetched_at").in("id", [...sourceIds])
    : { data: [] };

  return {
    project: project as Project,
    procurements: ((procs ?? []) as Procurement[]).map((p) => {
      const own = ((contracts ?? []) as Contract[]).filter((c) => c.procurement_id === p.id).sort((a, b) => a.part_no - b.part_no);
      const ids = new Set(own.map((c) => c.id));
      return {
        ...p,
        notices: ((notices ?? []) as Notice[]).filter((n) => n.procurement_id === p.id),
        contracts: own,
        changes: ((changes ?? []) as ContractChange[]).filter((c) => ids.has(c.contract_id)),
      };
    }),
    events: (events ?? []) as RiskEvent[],
    sources: Object.fromEntries(((sources ?? []) as Source[]).map((s) => [s.id, s])),
  };
}

export type ReviewQueue = {
  events: (RiskEvent & { project_title: string })[];
  procurements: (Procurement & { project_title: string })[];
  catalog: CatalogEntry[];
  decisions: Decision[];
  sources: Record<string, Source>;
};

export async function getReviewQueue(): Promise<ReviewQueue> {
  const supabase = db();
  const [{ data: events }, { data: procs }, { data: catalog }, { data: decisions }, { data: projects }] = await Promise.all([
    supabase.from("rm_risk_events").select("*").eq("status", "proposed").order("confidence", { ascending: true }).limit(200),
    supabase.from("rm_procurements").select("*").eq("status", "proposed").order("match_confidence"),
    supabase.from("rm_risk_catalog").select("*").order("code"),
    supabase.from("rm_decisions").select("id,entity,entity_id,action,comment,actor,created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("rm_projects").select("id,title"),
  ]);
  const titles = new Map((projects ?? []).map((p) => [p.id as string, p.title as string]));
  const sourceIds = [...new Set((events ?? []).map((e) => e.source_id).filter(Boolean))] as string[];
  const { data: sources } = sourceIds.length ? await supabase.from("rm_sources").select("id,kind,title,url,external_id,fetched_at").in("id", sourceIds) : { data: [] };
  return {
    events: ((events ?? []) as RiskEvent[]).map((e) => ({ ...e, project_title: titles.get(e.project_id) ?? e.project_id })),
    procurements: ((procs ?? []) as Procurement[]).map((p) => ({ ...p, project_title: titles.get(p.project_id) ?? p.project_id })),
    catalog: (catalog ?? []) as CatalogEntry[],
    decisions: (decisions ?? []) as Decision[],
    sources: Object.fromEntries(((sources ?? []) as Source[]).map((s) => [s.id, s])),
  };
}

export async function getDashboardStats() {
  const supabase = db();
  const head = { count: "exact" as const, head: true };
  const results = await Promise.all([
    supabase.from("rm_projects").select("*", head),
    supabase.from("rm_projects").select("*", head).not("enriched_at", "is", null),
    supabase.from("rm_notices").select("*", head),
    supabase.from("rm_contracts").select("*", head),
    supabase.from("rm_risk_events").select("*", head).eq("status", "proposed"),
    supabase.from("rm_risk_events").select("*", head).eq("status", "accepted"),
    supabase.from("rm_llm_runs").select("*", head),
  ]);
  const [projects, enriched, notices, contracts, proposed, accepted, runs] = results.map((r) => r.count ?? 0);
  const { data: spend } = await supabase.from("rm_llm_runs").select("cost_usd");
  const costUsd = (spend ?? []).reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
  return { projects, enriched, notices, contracts, proposed, accepted, runs, costUsd };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getCatalog(): Promise<CatalogEntry[]> {
  const { data } = await db().from("rm_risk_catalog").select("*").order("code");
  return (data ?? []) as CatalogEntry[];
}
