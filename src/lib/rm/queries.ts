import "server-only";

import { databaseConfigured, db } from "@/lib/supabase/admin";

import { summarizeContracts } from "./contracts";
import type { MatchInfo } from "./types";

/** Dane projektu potrzebne w oknie sprawdzenia powiązania. */
export type MatchProject = { id: string; title: string; beneficiary_name: string; beneficiary_nip: string | null; public_id_type: string | null; public_id: string | null };
import { signedDocumentUrl } from "@/lib/ingest/documents";

import type { ChangeReport, DocumentFinding, ExternalCheck, ProjectDocument } from "./types";
import type { CatalogEntry, Contract, ContractChange, Decision, Notice, Procurement, Project, RiskEvent, Source } from "./types";

export { databaseConfigured };


export type ProjectSummary = Project & {
  procurements: number;
  /** Status najlepszego dopasowania do postępowania w BZP (null = brak dopasowania). */
  matchStatus: "accepted" | "proposed" | null;
  /** Najlepsze (nieodrzucone) dopasowanie z danymi do okna sprawdzenia; null = brak. */
  match: MatchInfo | null;
  /** Czy wszystkie znalezione dopasowania zostały odrzucone przez eksperta. */
  matchRejected: boolean;
  contract: Pick<Contract, "initial_value" | "paid_total" | "cost_deviation_pct" | "delay_days"> | null;
  events: { proposed: number; accepted: number };
};

export { summarizeContracts } from "./contracts";
export type { MatchInfo } from "./types";

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = db();
  const [{ data: projects }, { data: procs }, { data: contracts }, { data: events }, { data: contractNotices }] = await Promise.all([
    supabase.from("rm_projects").select("*").order("id"),
    supabase.from("rm_procurements").select("id,project_id,status,match_confidence,bzp_number,title,buyer_name,buyer_nip,cpv,match_method,match_basis").order("match_confidence", { ascending: false }),
    supabase.from("rm_contracts").select("procurement_id,part_no,initial_value,paid_total,cost_deviation_pct,delay_days"),
    supabase.from("rm_risk_events").select("project_id,status"),
    supabase.from("rm_notices").select("procurement_id,published_at, rm_sources!inner(url)").eq("notice_type", "ContractNotice"),
  ]);
  const noticeByProc = new Map(
    (contractNotices ?? []).map((n) => {
      const src = (Array.isArray(n.rm_sources) ? n.rm_sources[0] : n.rm_sources) as { url: string | null } | null;
      return [n.procurement_id as string, { url: src?.url ?? null, published_at: n.published_at as string | null }];
    }),
  );

  return ((projects ?? []) as Project[]).map((p) => {
    const own = (procs ?? []).filter((x) => x.project_id === p.id);
    const active = own.filter((x) => x.status !== "rejected");
    // Główne dopasowanie: zatwierdzone, a jeśli brak — najpewniejsza propozycja.
    const primary = active.find((x) => x.status === "accepted") ?? active[0] ?? null;
    // Koszt i czas tylko z zatwierdzonego dopasowania (niepotwierdzone mogą dotyczyć cudzego przetargu).
    const contract = primary?.status === "accepted" ? summarizeContracts(p, (contracts ?? []).filter((c) => c.procurement_id === primary.id) as Contract[]) : null;
    const ownEvents = (events ?? []).filter((e) => e.project_id === p.id);
    const notice = primary ? noticeByProc.get(primary.id) : undefined;
    return {
      ...p,
      procurements: active.length,
      matchStatus: primary?.status ?? null,
      match: primary
        ? {
            id: primary.id,
            status: primary.status,
            bzp_number: primary.bzp_number,
            title: primary.title,
            buyer_name: primary.buyer_name,
            buyer_nip: primary.buyer_nip,
            cpv: primary.cpv,
            confidence: Number(primary.match_confidence),
            method: primary.match_method,
            basis: primary.match_basis ?? [],
            notice_url: notice?.url ?? null,
            published_at: notice?.published_at ?? null,
          }
        : null,
      matchRejected: own.length > 0 && active.length === 0,
      contract,
      events: { proposed: ownEvents.filter((e) => e.status === "proposed").length, accepted: ownEvents.filter((e) => e.status === "accepted").length },
    };
  });
}

export type ProjectDetail = {
  documents: (ProjectDocument & { findings: DocumentFinding[] })[];
  externalChecks: ExternalCheck[];
  changeReports: ChangeReport[];
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
  const [{ data: notices }, { data: contracts }, { data: events }, { data: docs }, { data: findings }, { data: checks }, { data: reports }] = await Promise.all([
    supabase.from("rm_notices").select("*").in("procurement_id", procIds.length ? procIds : none).order("published_at"),
    supabase.from("rm_contracts").select("*").in("procurement_id", procIds.length ? procIds : none),
    supabase.from("rm_risk_events").select("*").eq("project_id", id).order("created_at"),
    supabase.from("rm_documents").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("rm_document_findings").select("*").eq("project_id", id).order("created_at"),
    supabase.from("rm_external_checks").select("*").eq("project_id", id).order("source"),
    supabase.from("rm_change_reports").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  const documents = await Promise.all(
    ((docs ?? []) as (ProjectDocument & { storage_path: string | null })[]).map(async (d) => ({
      ...d,
      download_url: await signedDocumentUrl(d.storage_path),
      findings: ((findings ?? []) as DocumentFinding[]).filter((f) => f.document_id === d.id),
    })),
  );
  const contractIds = (contracts ?? []).map((c) => c.id as string);
  const { data: changes } = await supabase.from("rm_contract_changes").select("*").in("contract_id", contractIds.length ? contractIds : none).order("change_no");

  const sourceIds = new Set<string>();
  (notices ?? []).forEach((n) => sourceIds.add(n.source_id));
  (events ?? []).forEach((e) => e.source_id && sourceIds.add(e.source_id));
  if (project.source_id) sourceIds.add(project.source_id);
  documents.forEach((d) => d.source_id && sourceIds.add(d.source_id));
  (changes ?? []).forEach((c) => ((c.related_source_ids ?? []) as string[]).forEach((sid) => sourceIds.add(sid)));
  (checks ?? []).forEach((c) => c.source_id && sourceIds.add(c.source_id));
  const { data: sources } = sourceIds.size
    ? await supabase.from("rm_sources").select("id,kind,title,url,external_id,fetched_at").in("id", [...sourceIds])
    : { data: [] };
  // Źródło „dokument eksperta” prowadzi do tymczasowego linku do oryginału pliku.
  const docUrlBySource = new Map(documents.filter((d) => d.source_id).map((d) => [d.source_id as string, d.download_url ?? null]));
  for (const src of (sources ?? []) as Source[]) if (src.kind === "upload") src.url = docUrlBySource.get(src.id) ?? src.url;

  return {
    documents,
    externalChecks: (checks ?? []) as ExternalCheck[],
    changeReports: (reports ?? []) as ChangeReport[],
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
  procurements: (Procurement & { project_title: string; project: MatchProject; notice_url: string | null; published_at: string | null })[];
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
    supabase.from("rm_projects").select("id,title,beneficiary_name,beneficiary_nip,public_id_type,public_id"),
  ]);
  const titles = new Map((projects ?? []).map((p) => [p.id as string, p.title as string]));
  const procIds = (procs ?? []).map((p) => p.id as string);
  const { data: cns } = procIds.length
    ? await supabase.from("rm_notices").select("procurement_id,published_at, rm_sources!inner(url)").eq("notice_type", "ContractNotice").in("procurement_id", procIds)
    : { data: [] };
  const noticeByProc = new Map(
    (cns ?? []).map((n) => {
      const src = (Array.isArray(n.rm_sources) ? n.rm_sources[0] : n.rm_sources) as { url: string | null } | null;
      return [n.procurement_id as string, { url: src?.url ?? null, published_at: n.published_at as string | null }];
    }),
  );
  const sourceIds = [...new Set((events ?? []).map((e) => e.source_id).filter(Boolean))] as string[];
  const { data: sources } = sourceIds.length ? await supabase.from("rm_sources").select("id,kind,title,url,external_id,fetched_at").in("id", sourceIds) : { data: [] };
  return {
    events: ((events ?? []) as RiskEvent[]).map((e) => ({ ...e, project_title: titles.get(e.project_id) ?? e.project_id })),
    procurements: ((procs ?? []) as Procurement[]).map((p) => {
      const pr = (projects ?? []).find((x) => x.id === p.project_id);
      const cn = noticeByProc.get(p.id);
      return {
        ...p,
        project_title: titles.get(p.project_id) ?? p.project_id,
        project: { id: p.project_id, title: pr?.title ?? p.project_id, beneficiary_name: pr?.beneficiary_name ?? "", beneficiary_nip: pr?.beneficiary_nip ?? null, public_id_type: pr?.public_id_type ?? null, public_id: pr?.public_id ?? null },
        notice_url: cn?.url ?? null,
        published_at: cn?.published_at ?? null,
      };
    }),
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

export type SourceDetail = Source & { text_content: string | null; content_hash: string | null };

/** Źródło z pełnym tekstem — do podglądu z zaznaczonym cytatem. */
export async function getSource(id: string): Promise<SourceDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("rm_sources").select("id,kind,title,url,external_id,fetched_at,text_content,content_hash,raw").eq("id", id).maybeSingle();
  if (!data) return null;
  const { raw, ...source } = data as SourceDetail & { raw: { storage_path?: string } | null };
  // Dokument eksperta: link do oryginału jest tymczasowy (podpisany), generujemy go przy każdym wyświetleniu.
  if (source.kind === "upload" || source.kind === "assessment") source.url = await signedDocumentUrl(raw?.storage_path ?? null);
  return source;
}
