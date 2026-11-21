import "server-only";

import { z } from "zod";

import { db } from "@/lib/supabase/admin";
import type { CatalogEntry, Contract, ContractChange, Project, RiskEvent } from "@/lib/rm/types";

import { llmConfig } from "../config";
import { runTask, type TaskSpec } from "../run";

export const PROMPT_VERSION = "risk-events/v1";

export const riskEventsSchema = z.object({
  events: z
    .array(
      z.object({
        risk_code: z.string().describe("Kod z katalogu (R01–R15) albo NOWY, jeśli żaden nie pasuje"),
        title: z.string().describe("Krótki tytuł zdarzenia po polsku"),
        signal: z.string().describe("Warunek lub sygnał w dokumentach"),
        event: z.string().describe("Co się wydarzyło (udokumentowane) albo co może się wydarzyć"),
        impact: z.string().describe("Skutek dla kosztu, terminu, zakresu lub jakości"),
        cause: z.string().describe("Możliwa przyczyna; 'brak danych', jeśli dokumenty jej nie podają"),
        mitigation: z.string().describe("Działania zaradcze lub zapis umowny ograniczający ryzyko w kolejnych inwestycjach"),
        delay_days: z.number().nullable().describe("Opóźnienie w dniach, jeśli wynika ze źródła"),
        cost_pln: z.number().nullable().describe("Wzrost kosztu w PLN brutto, jeśli wynika ze źródła"),
        quote: z.string().describe("DOSŁOWNY fragment źródła (kopiuj znak w znak, max 300 znaków)"),
        source_notice: z.string().describe("Numer ogłoszenia, z którego pochodzi cytat"),
        confidence: z.number().min(0).max(1),
      }),
    )
    .describe("Zdarzenia ryzyka udokumentowane w źródłach"),
  new_categories: z
    .array(z.object({ name: z.string(), justification: z.string() }))
    .describe("Propozycje nowych kategorii do zatwierdzenia przez eksperta (puste, jeśli katalog wystarcza)"),
  data_gaps: z.array(z.string()).describe("Jakich dokumentów brakuje do pewniejszej oceny"),
});

export type RiskEventsOutput = z.infer<typeof riskEventsSchema>;

/** Wybieramy tylko sekcje niosące informację o przebiegu (oszczędność tokenów — patrz kalkulacja w README). */
function relevantSections(type: string, text: string): string {
  const from = (re: RegExp) => {
    const i = text.search(re);
    return i >= 0 ? text.slice(i) : text;
  };
  if (type === "ContractPerformingNotice") return from(/SEKCJA V/);
  if (type === "AgreementUpdateNotice") return from(/SEKCJA V/);
  if (type === "TenderResultNotice") return from(/SEKCJA V/).slice(0, 2500);
  if (type === "ContractNotice") {
    const i = text.search(/Krótki opis przedmiotu zamówienia/i);
    return i >= 0 ? text.slice(i, i + 3500) : text.slice(0, 3500);
  }
  return text.slice(0, 2000);
}

const pln = (v: number | null) => (v == null ? "brak" : `${v.toLocaleString("pl-PL")} zł`);

export async function buildRiskEventsSpec(projectId: string): Promise<{ spec: TaskSpec<typeof riskEventsSchema>; sourceTexts: Map<string, { id: string; text: string }> }> {
  const supabase = db();
  const { data: project } = await supabase.from("rm_projects").select("*").eq("id", projectId).single();
  if (!project) throw new Error("Nie znaleziono projektu.");
  const p = project as Project;

  const { data: procs } = await supabase.from("rm_procurements").select("id").eq("project_id", projectId).neq("status", "rejected");
  const procIds = (procs ?? []).map((x) => x.id as string);
  const [{ data: notices }, { data: contracts }, { data: catalog }, { data: examples }] = await Promise.all([
    supabase.from("rm_notices").select("notice_type,notice_number,source_id,published_at").in("procurement_id", procIds.length ? procIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("rm_contracts").select("*").in("procurement_id", procIds.length ? procIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("rm_risk_catalog").select("*").eq("approved", true).order("code"),
    supabase.from("rm_risk_events").select("risk_code,title,signal,event,impact,cause,mitigation,quote").eq("status", "accepted").eq("exemplary", true).limit(5),
  ]);

  const contractIds = (contracts ?? []).map((c) => c.id as string);
  const { data: changes } = contractIds.length ? await supabase.from("rm_contract_changes").select("*").in("contract_id", contractIds) : { data: [] };

  const sourceIds = (notices ?? []).map((n) => n.source_id as string);
  const { data: sources } = sourceIds.length ? await supabase.from("rm_sources").select("id,text_content").in("id", sourceIds) : { data: [] };
  const textById = new Map((sources ?? []).map((s) => [s.id as string, (s.text_content as string) ?? ""]));

  const sourceTexts = new Map<string, { id: string; text: string }>();
  let budget = llmConfig.maxInputChars;
  const order = ["ContractPerformingNotice", "AgreementUpdateNotice", "TenderResultNotice", "ContractNotice"];
  const docs = [...(notices ?? [])]
    .sort((a, b) => order.indexOf(a.notice_type) - order.indexOf(b.notice_type))
    .map((n) => {
      const full = textById.get(n.source_id) ?? "";
      sourceTexts.set(n.notice_number, { id: n.source_id, text: full });
      const part = relevantSections(n.notice_type, full).slice(0, Math.max(0, budget));
      budget -= part.length;
      return part ? `### Ogłoszenie ${n.notice_number} (${n.notice_type}, ${String(n.published_at).slice(0, 10)})\n${part}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const contractLines = ((contracts ?? []) as Contract[])
    .map(
      (c) =>
        `Umowa${c.part_no > 0 && c.part_no < 100 ? ` (część ${c.part_no})` : ""}: wykonawca ${c.contractor_name ?? "?"}, zawarta ${c.signed_at ?? "?"}, wartość ${pln(c.initial_value)}, okres ${c.initial_months ?? "?"} mies., ` +
        `planowany koniec ${c.planned_end ?? "?"}, faktyczny ${c.actual_end ?? "brak danych"}, wypłacono ${pln(c.paid_total)}, ` +
        `odchylenie kosztu ${c.cost_deviation_pct ?? "?"}%, opóźnienie ${c.delay_days ?? "?"} dni, ofert ${c.offers_count ?? "?"}.`,
    )
    .join("\n");
  const changeLines = ((changes ?? []) as ContractChange[])
    .map((c) => `- zmiana ${c.change_no ?? "?"}: ${c.legal_basis ?? ""}; przyczyna: ${c.reason ?? ""}; wartość: ${pln(c.value_change)}`)
    .join("\n");

  const catalogText = ((catalog ?? []) as CatalogEntry[]).map((c) => `${c.code} ${c.name} — ${c.effects ?? ""}`).join("\n");
  const examplesText = (examples ?? []).length
    ? `\nZatwierdzone przez eksperta przykłady wzorcowe:\n${JSON.stringify(examples, null, 0)}`
    : "";

  const system = `Jesteś analitykiem ryzyk inwestycji publicznych (sektor wodno-kanalizacyjny, Polska, ustawa Pzp).
Na podstawie ogłoszeń BZP identyfikujesz UDOKUMENTOWANE zdarzenia wpływające na realizację umowy i przypisujesz je do katalogu ryzyk.
Zasady:
- Każde zdarzenie musi mieć dosłowny cytat ze źródła (pole quote) i numer ogłoszenia. Bez cytatu — nie zgłaszaj.
- Schemat: sygnał w dokumentach → zdarzenie → wpływ → działanie zaradcze.
- Rozróżniaj: „dokument nie wspomina” ≠ „potwierdzono, że nie wystąpiło”. Gdy przyczyna nie jest podana, wpisz „brak danych”.
- Kwoty umów i wypłat są brutto. Nie zgaduj liczb, których nie ma w źródle.
- Działania zaradcze formułuj jako rekomendacje dla kolejnych inwestycji (np. zapis w PPU, rozpoznanie przed przetargiem).
- Odpowiadaj po polsku.
Katalog ryzyk:
${catalogText}${examplesText}`;

  const prompt = `Projekt ${p.id}: ${p.title}
Zamawiający: ${p.beneficiary_name} (NIP ${p.beneficiary_nip ?? "?"}), ${p.province ?? ""}. Podsektor: ${p.subsector_main ?? "?"}.
${p.annotation ? `Adnotacja instytucji: ${p.annotation.slice(0, 800)}` : ""}

Dane obliczone z ogłoszeń:
${contractLines || "Brak odtworzonej umowy."}
Zmiany umowy:
${changeLines || "Brak informacji o zmianach."}

Źródła:
${docs || "Brak ogłoszeń."}`;

  return {
    spec: { task: "risk_events", promptVersion: PROMPT_VERSION, system, prompt, schema: riskEventsSchema, projectId },
    sourceTexts,
  };
}

const squash = (s: string) => s.replace(/[\s"„”]+/g, " ").trim().toLowerCase();

/** Zapis wyników modelu jako propozycji do weryfikacji; cytat sprawdzamy dosłownie w tekście źródła. */
export async function saveRiskEvents(projectId: string, runId: string, output: RiskEventsOutput, sourceTexts: Map<string, { id: string; text: string }>) {
  const supabase = db();
  await supabase.from("rm_risk_events").delete().eq("project_id", projectId).eq("origin", "llm").eq("status", "proposed");

  const rows: Partial<RiskEvent>[] = output.events.map((e) => {
    const source = sourceTexts.get(e.source_notice) ?? [...sourceTexts.values()].find((s) => squash(s.text).includes(squash(e.quote)));
    const verified = Boolean(source && e.quote && squash(source.text).includes(squash(e.quote)));
    return {
      project_id: projectId,
      risk_code: e.risk_code,
      title: e.title,
      signal: e.signal,
      event: e.event,
      impact: e.impact,
      cause: e.cause,
      mitigation: e.mitigation,
      delay_days: e.delay_days == null ? null : Math.round(e.delay_days),
      cost_pln: e.cost_pln,
      quote: e.quote,
      source_id: source?.id ?? null,
      // niezweryfikowany cytat obniża pewność
      confidence: Math.round((verified ? e.confidence : e.confidence * 0.5) * 100) / 100,
      origin: "llm",
      llm_run_id: runId,
      quote_verified: verified,
      status: "proposed",
    };
  });
  if (rows.length) {
    const { error } = await supabase.from("rm_risk_events").insert(rows);
    if (error) throw new Error(`Zapis zdarzeń LLM: ${error.message}`);
  }

  // propozycje nowych kategorii trafiają do katalogu jako niezatwierdzone
  for (const [i, cat] of output.new_categories.entries()) {
    await supabase
      .from("rm_risk_catalog")
      .upsert({ code: `P-${runId.slice(0, 4)}-${i + 1}`, name: cat.name, effects: cat.justification, approved: false, proposed_by: "llm" }, { onConflict: "code" });
  }
  return rows.length;
}

export async function analyzeProjectRisks(projectId: string, model = llmConfig.model) {
  const { spec, sourceTexts } = await buildRiskEventsSpec(projectId);
  const result = await runTask(spec, model);
  if (!result.output) throw new Error(result.error ?? "Model nie zwrócił wyniku.");
  const saved = await saveRiskEvents(projectId, result.runId, result.output, sourceTexts);
  return { ...result, saved };
}
