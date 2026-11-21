import "server-only";

import type { CatalogEntry, Project, Source } from "@/lib/rm/types";
import { db } from "@/lib/supabase/admin";

import type { Assessment, AssessmentItem, AssessmentMatch, AssessmentSummary } from "./types";

export type AssessmentListItem = Pick<Assessment, "id" | "title" | "description" | "version" | "created_at" | "updated_at" | "llm_run_id" | "mode"> & {
  params: Pick<Assessment["params"], "subsector_main" | "province" | "budget_pln" | "length_m">;
  summary: Pick<AssessmentSummary, "included" | "uncertainty" | "cost" | "delay_days"> | Record<string, never>;
  items: number;
};

export async function listAssessments(): Promise<AssessmentListItem[]> {
  const supabase = db();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("rm_assessments").select("id,title,description,version,created_at,updated_at,llm_run_id,mode,params,summary").order("updated_at", { ascending: false }).limit(200),
    supabase.from("rm_assessment_items").select("assessment_id"),
  ]);
  return ((data ?? []) as Assessment[]).map((a) => ({
    ...a,
    items: (counts ?? []).filter((c) => c.assessment_id === a.id).length,
  }));
}

export type CaseProject = Pick<Project, "id" | "title" | "beneficiary_name" | "city" | "province" | "subsector_main" | "works_type"> & { notice_source_id: string | null };

export type AssessmentDetail = {
  assessment: Assessment;
  matches: (AssessmentMatch & { project: CaseProject })[];
  items: AssessmentItem[];
  sources: Record<string, Source>;
  documents: Source[];
  catalog: Pick<CatalogEntry, "code" | "name">[];
};

export async function getAssessment(id: string): Promise<AssessmentDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = db();
  const { data: row } = await supabase.from("rm_assessments").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const assessment = row as Assessment;
  const [{ data: matches }, { data: items }, { data: catalog }] = await Promise.all([
    supabase.from("rm_assessment_matches").select("*").eq("assessment_id", id).order("rank"),
    supabase.from("rm_assessment_items").select("*").eq("assessment_id", id).order("sort"),
    supabase.from("rm_risk_catalog").select("code,name").order("code"),
  ]);
  const projectIds = (matches ?? []).map((m) => m.project_id as string);
  const { data: projects } = await supabase
    .from("rm_projects")
    .select("id,title,beneficiary_name,city,province,subsector_main,works_type")
    .in("id", projectIds.length ? projectIds : ["-"]);
  const { data: procs } = await supabase.from("rm_procurements").select("id,project_id").eq("status", "accepted").in("project_id", projectIds.length ? projectIds : ["-"]);
  const { data: notices } = await supabase
    .from("rm_notices")
    .select("procurement_id,source_id")
    .eq("notice_type", "ContractNotice")
    .in("procurement_id", (procs ?? []).map((p) => p.id as string).concat("00000000-0000-0000-0000-000000000000"));
  const noticeByProject = new Map<string, string>();
  for (const p of procs ?? []) {
    const n = (notices ?? []).find((x) => x.procurement_id === p.id);
    if (n && !noticeByProject.has(p.project_id as string)) noticeByProject.set(p.project_id as string, n.source_id as string);
  }

  const sourceIds = new Set<string>([...noticeByProject.values(), ...(assessment.document_source_ids ?? [])]);
  for (const it of (items ?? []) as AssessmentItem[]) for (const ex of it.support?.examples ?? []) if (ex.source_id) sourceIds.add(ex.source_id);
  const { data: sources } = sourceIds.size ? await supabase.from("rm_sources").select("id,kind,title,url,external_id,fetched_at").in("id", [...sourceIds]) : { data: [] };
  const byId = Object.fromEntries(((sources ?? []) as Source[]).map((s) => [s.id, s]));

  return {
    assessment,
    matches: ((matches ?? []) as AssessmentMatch[]).map((m) => {
      const p = (projects ?? []).find((x) => x.id === m.project_id) as CaseProject | undefined;
      return {
        ...m,
        score: Number(m.score),
        project: { ...(p ?? { id: m.project_id, title: m.project_id, beneficiary_name: "", city: null, province: null, subsector_main: null, works_type: null }), notice_source_id: noticeByProject.get(m.project_id) ?? null },
      };
    }),
    items: (items ?? []) as AssessmentItem[],
    sources: byId,
    documents: (assessment.document_source_ids ?? []).map((sid) => byId[sid]).filter(Boolean),
    catalog: (catalog ?? []) as Pick<CatalogEntry, "code" | "name">[],
  };
}

/** Pełna ocena do eksportu JSON (zagnieżdżona: założenia, statystyka, przypadki, pozycje ze źródłami). */
export async function assessmentExport(id: string) {
  const detail = await getAssessment(id);
  if (!detail) return null;
  const { assessment, matches, items, sources } = detail;
  return {
    assessment: { id: assessment.id, title: assessment.title, description: assessment.description, version: assessment.version, created_at: assessment.created_at, updated_at: assessment.updated_at },
    params: assessment.params,
    params_origin: assessment.params_origin,
    summary: assessment.summary,
    // Porównywalność nie jest już pokazywana (zostaje samo podobieństwo opisu) — nie eksportujemy jej, żeby nie myliła.
    matches: matches.map(({ project, ...m }) => ({ ...(Object.fromEntries(Object.entries(m).filter(([key]) => key !== "comparability")) as Omit<AssessmentMatch, "comparability">), project_title: project.title, beneficiary: project.beneficiary_name, province: project.province, notice: project.notice_source_id ? sources[project.notice_source_id] ?? null : null })),
    items: items.map((it) => ({ ...it, examples: (it.support?.examples ?? []).map((ex) => ({ ...ex, source: ex.source_id ? sources[ex.source_id] ?? null : null })) })),
    legend: {
      basis: { calc: "Obliczenie na danych przypadków", source: "Zdarzenia udokumentowane w źródłach", expert: "Katalog ekspercki / decyzja eksperta", input: "Dane podane przez użytkownika", llm: "Wniosek modelu AI — do weryfikacji" },
    },
  };
}

export type ReferenceCaseRow = {
  project_id: string;
  title: string;
  beneficiary_name: string | null;
  province: string | null;
  subsector_main: string | null;
  works_type: string | null;
  value: number | null;
  paid: number | null;
  cost_deviation_pct: number | null;
  months: number | null;
  delay_days: number | null;
  bzp_number: string | null;
  match_confidence: number | null;
  match_origin: "accepted" | "auto";
  snapshot_at: string;
  events: number;
  risk_codes: string[];
};

export type ReferenceBase = {
  cases: ReferenceCaseRow[];
  lastBuild: { at: string; skipped: { projectId: string; reason: string }[] } | null;
};

/** Baza porównawcza do ocen: sklonowane zakończone projekty z zaakceptowanymi zdarzeniami. */
export async function getReferenceBase(): Promise<ReferenceBase> {
  const supabase = db();
  const [{ data: cases }, { data: events }, { data: builds }] = await Promise.all([
    supabase.from("rm_ref_cases").select("project_id,title,beneficiary_name,province,subsector_main,works_type,value,paid,cost_deviation_pct,months,delay_days,bzp_number,match_confidence,match_origin,snapshot_at").order("project_id"),
    supabase.from("rm_ref_events").select("project_id,risk_code"),
    supabase.from("rm_decisions").select("created_at,after").eq("entity", "reference_base").order("created_at", { ascending: false }).limit(1),
  ]);
  const build = builds?.[0] as { created_at: string; after: { skipped?: { projectId: string; reason: string }[] } } | undefined;
  return {
    cases: (cases ?? []).map((c) => {
      const own = (events ?? []).filter((e) => e.project_id === c.project_id);
      return { ...(c as Omit<ReferenceCaseRow, "events" | "risk_codes">), events: own.length, risk_codes: [...new Set(own.map((e) => e.risk_code as string))].sort() };
    }),
    lastBuild: build ? { at: build.created_at, skipped: build.after?.skipped ?? [] } : null,
  };
}
