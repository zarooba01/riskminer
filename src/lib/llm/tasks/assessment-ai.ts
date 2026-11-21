import "server-only";

import { z } from "zod";

import { loadComparisonCases, type CaseEvent } from "@/lib/assess/cases";
import { summarizeSample, type ItemRow, type MatchRow } from "@/lib/assess/engine";
import type { ParamInput } from "@/lib/assess/params";
import { defaultWeights, provinceOptions, subsectorOptions, worksTypeOptions, type Assessment, type AssessmentParams, type AssessmentSummary, type ItemExample, type ParamKey, type ParamOrigin } from "@/lib/assess/types";
import { selectRelevantPages } from "@/lib/ingest/documents";
import { db } from "@/lib/supabase/admin";

import { llmConfig } from "../config";
import { runTask } from "../run";

export const PROMPT_VERSION = "assessment-ai/v1";

const schema = z.object({
  params: z
    .object({
      subsector_main: z.string().nullable().describe(`Podsektor główny, jeden z: ${subsectorOptions.join("; ")}`),
      works_type: z.string().nullable().describe(`Rodzaj robót: ${worksTypeOptions.join(" albo ")}`),
      province: z.string().nullable().describe("Województwo małymi literami (np. mazowieckie); także wywnioskowane z nazwy gminy/miejscowości"),
      length_m: z.number().nullable().describe("Długość sieci w metrach"),
      budget_pln: z.number().nullable().describe("Planowany budżet brutto w PLN"),
      duration_months: z.number().nullable().describe("Czas realizacji robót w miesiącach (od podpisania umowy do odbioru)"),
      local_conditions: z.string().nullable().describe("Znane warunki lokalne z opisu (krótko)"),
    })
    .describe("Parametry planu odczytane z opisu i dokumentów; null, gdy brak — nie zgaduj liczb"),
  similar: z
    .array(z.object({ project_id: z.string(), score: z.number().min(0).max(100), reasons: z.array(z.string()).describe("1–3 krótkie powody podobieństwa") }))
    .describe("5–10 najbardziej podobnych przypadków z listy (identyfikatory RM-…), od najbardziej podobnego"),
  risks: z
    .array(
      z.object({
        risk_code: z.string().describe("Kod katalogu R01–R15"),
        why: z.string().describe("1–2 zdania: co wydarzyło się w podobnych przypadkach i dlaczego dotyczy planu"),
        project_ids: z.array(z.string()).describe("Przypadki, na których opiera się ryzyko"),
        event_ids: z.array(z.string()).describe("Aliasy zdarzeń (E1, E2…), na których opiera się ryzyko"),
        checks: z.array(z.string()).describe("1–3 rzeczy do sprawdzenia przed przetargiem — konkretne dla tego planu"),
        actions: z.array(z.string()).describe("1–2 działania do rozważenia"),
        clauses: z.array(z.string()).describe("1–2 zapisy umowne, które mogą pomóc"),
      }),
    )
    .describe("Najwyżej 6 ryzyk, od najważniejszego"),
  local_checks: z.array(z.object({ title: z.string(), body: z.string() })).describe("Najwyżej 5 kwestii do lokalnego potwierdzenia (z opisu planu lub czego opis nie podaje)"),
});

type Output = z.infer<typeof schema>;

const mln = (v: number | null) => (v == null ? "?" : `${(v / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} mln zł`);
const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
};

/**
 * Ocena nowej inwestycji modelem AI (tryb „AI”, bez analizy deterministycznej): model dobiera podobne przypadki z bazy
 * porównawczej i formułuje ryzyka, rzeczy do sprawdzenia, działania i zapisy umowne. Każdy wniosek musi wskazywać istniejący
 * przypadek lub zdarzenie — inne są odrzucane. Mediany, przedziały i n liczymy z danych przypadków wybranych przez model.
 * Jedno wywołanie przez runTask (zapis kosztu, cache po treści wejścia).
 */
export async function runAiAssessment(id: string, input?: ParamInput, model = llmConfig.model): Promise<{ included: number; considered: number; items: number; dropped: number; costUsd: number | null; cached: boolean }> {
  const supabase = db();
  const { data: row } = await supabase.from("rm_assessments").select("*").eq("id", id).maybeSingle();
  if (!row) throw new Error("Nie znaleziono oceny.");
  const a = row as Assessment & { mode: string };

  // Parametry podane przez użytkownika (input) zostają i trafiają do modelu jako ustalone; resztę ustala model.
  const fixed: Partial<Record<ParamKey, unknown>> = {};
  for (const [key, origin] of Object.entries(a.params_origin ?? {}) as [ParamKey, ParamOrigin][]) {
    if (origin === "input") fixed[key] = (a.params as unknown as Record<string, unknown>)[key];
  }
  for (const [key, value] of Object.entries(input ?? {})) {
    if (key === "weights" || key === "top_k") continue;
    if (value === "" || value == null) delete fixed[key as ParamKey];
    else fixed[key as ParamKey] = value;
  }

  const { data: docs } = a.document_source_ids?.length ? await supabase.from("rm_sources").select("id,raw,text_content").in("id", a.document_source_ids) : { data: [] };
  const docTexts = (docs ?? []).map((d) => ({ id: d.id as string, text: (d.text_content as string | null) ?? "", pages: ((d.raw as { pages?: string[] } | null)?.pages ?? []) as string[] }));
  const docBudget = Math.floor(5000 / Math.max(1, docTexts.length));
  const docBlock = docTexts.map((d) => selectRelevantPages(d.pages, docBudget).text).join("\n\n");

  const { cases, catalog } = await loadComparisonCases();
  if (!cases.length) throw new Error("Baza porównawcza jest pusta — zbuduj ją w zakładce „Baza porównawcza”.");
  const approved = catalog.filter((c) => c.approved);

  // Krótkie aliasy zdarzeń (E1…), najwyżej 3 na przypadek — mniej tokenów, mniej pomyłek w odwołaniach.
  const alias = new Map<string, CaseEvent & { caseId: string }>();
  const casesText = cases
    .map((c) => {
      const events = [...c.events].sort((x, y) => Number(Boolean(y.quote)) - Number(Boolean(x.quote))).slice(0, 3);
      const lines = events.map((e) => {
        const key = `E${alias.size + 1}`;
        alias.set(key, { ...e, caseId: c.project.id });
        return `  [${key}] ${e.risk_code}: ${clip(e.title, 70)}; przyczyna: ${clip(e.cause, 80) || "brak danych"}`;
      });
      return [
        `${c.project.id} | ${clip(c.project.title, 110)} | ${c.project.subsector_main ?? "?"}; ${c.project.works_type ?? "?"}; ${c.project.province ?? "?"} | umowa ${mln(c.value)}, ${c.months ?? "?"} mies.${c.length_m ? `, ${(c.length_m / 1000).toFixed(1)} km` : ""} | koszt ${c.cost_deviation_pct ?? "?"}%, opóźnienie ${c.delay_days ?? "?"} dni`,
        ...lines,
      ].join("\n");
    })
    .join("\n");

  const system = `Jesteś ekspertem przygotowania inwestycji wodno-kanalizacyjnych w Polsce (ustawa Pzp). Pomagasz urzędnikowi przed przetargiem.
Dostajesz opis planowanej inwestycji i bazę zakończonych inwestycji (z liczbami z umów i udokumentowanymi zdarzeniami ryzyka).
Zadania: 1) odczytaj parametry planu, 2) wybierz 5–10 najbardziej podobnych przypadków (rodzaj infrastruktury, zakres, skala, warunki), 3) wskaż najważniejsze ryzyka z katalogu z rzeczami do sprawdzenia przed przetargiem, działaniami i zapisami umownymi, 4) kwestie do lokalnego potwierdzenia.
Zasady:
- Używaj WYŁĄCZNIE identyfikatorów przypadków (RM-…) i aliasów zdarzeń (E…) z listy. Każde ryzyko musi wskazywać co najmniej jeden przypadek lub zdarzenie.
- Pisz konkretnie dla tego planu, krótko. Nie wymyślaj liczb ani faktów spoza danych.
- Odpowiadaj po polsku.
Katalog ryzyk:
${approved.map((c) => `${c.code} ${c.name}`).join("\n")}`;
  const fixedText = Object.entries(fixed)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const prompt = `Opis planu: ${a.description || "(brak — tylko dokument)"}
${fixedText ? `Parametry potwierdzone przez użytkownika (nie zmieniaj): ${fixedText}\n` : ""}${docBlock ? `\nDokument planu:\n${docBlock}\n` : ""}
Baza zakończonych inwestycji:
${casesText}`;

  const result = await runTask({ task: "assessment_ai", promptVersion: PROMPT_VERSION, system, prompt, schema }, model);
  if (!result.output) throw new Error(result.error ?? "Model nie zwrócił wyniku.");
  const out: Output = result.output;

  // Parametry: ustalone przez użytkownika > model (oznaczenie „model AI”). Wartości spoza słowników odrzucamy.
  const pick = (key: ParamKey, value: unknown, allowed?: string[]) => {
    if (key in fixed) return fixed[key];
    if (value == null || value === "") return null;
    if (allowed && !allowed.includes(String(value))) return null;
    return value;
  };
  const params: AssessmentParams = {
    subsector_main: pick("subsector_main", out.params.subsector_main, subsectorOptions) as string | null,
    subsectors_extra: [],
    works_type: pick("works_type", out.params.works_type, worksTypeOptions) as string | null,
    province: pick("province", out.params.province ? String(out.params.province).toLowerCase() : null, provinceOptions) as string | null,
    length_m: pick("length_m", out.params.length_m) as number | null,
    budget_pln: pick("budget_pln", out.params.budget_pln) as number | null,
    duration_months: pick("duration_months", out.params.duration_months) as number | null,
    local_conditions: pick("local_conditions", out.params.local_conditions) as string | null,
    weights: a.params?.weights ?? defaultWeights,
    top_k: a.params?.top_k ?? 8,
  };
  const origin: Partial<Record<ParamKey, ParamOrigin>> = {};
  for (const key of ["subsector_main", "works_type", "province", "length_m", "budget_pln", "duration_months", "local_conditions"] as ParamKey[]) {
    if ((params as unknown as Record<string, unknown>)[key] != null) origin[key] = key in fixed ? "input" : "llm";
  }

  // Przypadki: tylko istniejące w bazie porównawczej, bez powtórzeń.
  const byId = new Map(cases.map((c) => [c.project.id, c]));
  let dropped = 0;
  const seen = new Set<string>();
  const similar = out.similar
    .filter((s) => {
      const ok = byId.has(s.project_id) && !seen.has(s.project_id);
      if (!ok) dropped++;
      seen.add(s.project_id);
      return ok;
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 10);
  const matches: MatchRow[] = similar.map((s, i) => {
    const c = byId.get(s.project_id)!;
    const hasNumbers = c.cost_deviation_pct != null || c.delay_days != null;
    return {
      project_id: c.project.id,
      rank: i + 1,
      score: Math.round(s.score),
      components: [],
      reasons: s.reasons.slice(0, 3),
      shared_terms: [],
      comparability: "średnia",
      included: hasNumbers,
      excluded_reason: hasNumbers ? null : "Brak danych o wykonaniu umowy (koszt i termin).",
      initial_value: c.value,
      paid_total: c.paid,
      cost_deviation_pct: c.cost_deviation_pct,
      initial_months: c.months,
      delay_days: c.delay_days,
      offers_count: c.offers,
    };
  });
  const included = matches.filter((m) => m.included).map((m) => byId.get(m.project_id)!);
  const N = included.length;
  const { summary, flags } = summarizeSample(params, included, cases.length, matches.length, []);

  // Ryzyka i zalecenia z modelu — tylko z oparciem w istniejących przypadkach lub zdarzeniach.
  const items: ItemRow[] = [...flags];
  let sort = items.length;
  const push = (row: Omit<ItemRow, "sort">) => items.push({ ...row, sort: sort++ });
  const codes = new Set(approved.map((c) => c.code));
  const usedCodes = new Set<string>();
  for (const r of out.risks.slice(0, 6)) {
    const events = r.event_ids.map((e) => alias.get(e)).filter((e): e is CaseEvent & { caseId: string } => Boolean(e));
    const pids = [...new Set([...r.project_ids.filter((p) => byId.has(p)), ...events.map((e) => e.caseId)])];
    if (!codes.has(r.risk_code) || usedCodes.has(r.risk_code) || (!pids.length && !events.length)) {
      dropped++;
      continue;
    }
    usedCodes.add(r.risk_code);
    const examples: ItemExample[] = events
      .filter((e) => e.quote && e.source_id)
      .slice(0, 3)
      .map((e) => ({ project_id: e.caseId, event_id: e.id, source_id: e.source_id, quote: clip(e.quote, 300), label: e.title }));
    // „Wystąpiło w X z N” liczymy z danych (zdarzenia z tym kodem w umowach próby), a nie z odwołań modelu.
    const inSample = included.filter((c) => c.events.some((e) => e.risk_code === r.risk_code)).length;
    push({
      item_key: `ai:risk:${r.risk_code}`,
      kind: "risk",
      risk_code: r.risk_code,
      title: `${r.risk_code} ${approved.find((c) => c.code === r.risk_code)?.name ?? ""}`.trim(),
      body: r.why,
      basis: "llm",
      support: { project_ids: pids, event_ids: events.map((e) => e.id), examples },
      n_cases: inSample,
      n_total: N,
    });
    const lists: [ItemRow["kind"], string[], number][] = [
      ["check", r.checks, 3],
      ["action", r.actions, 2],
      ["clause", r.clauses, 2],
    ];
    for (const [kind, list, max] of lists) {
      list.slice(0, max).forEach((text, i) =>
        push({ item_key: `ai:${kind}:${r.risk_code}:${i}`, kind, risk_code: r.risk_code, title: text, body: null, basis: "llm", support: { project_ids: pids }, n_cases: null, n_total: null }),
      );
    }
  }
  out.local_checks.slice(0, 5).forEach((g, i) => {
    // Kwestie lokalne to pytania do potwierdzenia na miejscu, nie fakty — nie wymagają odwołania do przypadku.
    push({ item_key: `ai:gap:${i}`, kind: "gap", risk_code: null, title: g.title, body: g.body, basis: "llm", support: {}, n_cases: null, n_total: null });
  });

  // Zapis: decyzje eksperta o wnioskach AI zostają (stały klucz pozycji); poprzednie statystyki do „było → jest”.
  const { data: oldItems } = await supabase.from("rm_assessment_items").select("item_key,status,risk_code").eq("assessment_id", id);
  const statusByKey = new Map((oldItems ?? []).map((i) => [i.item_key as string, i.status as string]));
  const prev = a.summary as AssessmentSummary;
  const { data: oldMatches } = await supabase.from("rm_assessment_matches").select("project_id,included").eq("assessment_id", id);
  summary.previous =
    a.version > 0 && prev?.generated_at
      ? {
          version: a.version,
          generated_at: prev.generated_at,
          included: prev.included,
          cost: prev.cost,
          delay_days: prev.delay_days,
          project_ids: (oldMatches ?? []).filter((m) => m.included).map((m) => m.project_id as string),
          risk_codes: (oldItems ?? []).filter((i) => String(i.item_key).includes("risk:")).map((i) => i.risk_code as string),
        }
      : null;

  await supabase.from("rm_assessment_matches").delete().eq("assessment_id", id);
  if (matches.length) {
    const { error } = await supabase.from("rm_assessment_matches").insert(matches.map((m) => ({ ...m, assessment_id: id })));
    if (error) throw new Error(`Zapis przypadków: ${error.message}`);
  }
  await supabase.from("rm_assessment_items").delete().eq("assessment_id", id);
  if (items.length) {
    const { error } = await supabase.from("rm_assessment_items").insert(items.map((it) => ({ ...it, assessment_id: id, status: statusByKey.get(it.item_key) ?? "proposed" })));
    if (error) throw new Error(`Zapis pozycji: ${error.message}`);
  }
  const { error } = await supabase
    .from("rm_assessments")
    .update({ params, params_origin: origin, summary, version: a.version + 1, llm_run_id: result.runId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Zapis oceny: ${error.message}`);
  return { included: N, considered: matches.length, items: items.length, dropped, costUsd: result.costUsd, cached: result.cached };
}
