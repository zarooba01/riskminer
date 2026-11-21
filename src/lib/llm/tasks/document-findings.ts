import "server-only";

import { z } from "zod";

import { selectRelevantPages } from "@/lib/ingest/documents";
import { db } from "@/lib/supabase/admin";
import type { CatalogEntry, Contract, ContractChange } from "@/lib/rm/types";

import { llmConfig } from "../config";
import { runTask } from "../run";
import { quoteFound } from "./risk-events";

export const DOC_PROMPT_VERSION = "document-findings/v1";

const topics = ["termin", "wartość", "przyczyna zmiany", "zakres", "wykonawca", "odbiór i wady", "kary", "inne"] as const;

export const documentFindingsSchema = z.object({
  summary: z.string().describe("Jedno-dwuzdaniowe podsumowanie, czego dotyczy dokument"),
  findings: z
    .array(
      z.object({
        kind: z.enum(["confirms", "adds", "conflicts"]).describe("confirms = potwierdza dane sprawy; adds = uzupełnia o nową informację; conflicts = różni się od danych sprawy"),
        topic: z.enum(topics),
        statement: z.string().describe("Ustalenie po polsku, jednym zdaniem"),
        doc_value: z.string().nullable().describe("Wartość według dokumentu (np. nowy termin, kwota)"),
        current_value: z.string().nullable().describe("Dotychczasowa wartość w danych sprawy (dla confirms i conflicts)"),
        quote: z.string().describe("DOSŁOWNY fragment dokumentu (max 300 znaków)"),
        page: z.number().describe("Numer strony ze znacznika [str. N], z której pochodzi cytat"),
        confidence: z.number().min(0).max(1),
      }),
    )
    .describe("Ustalenia z dokumentu względem danych sprawy"),
  events: z
    .array(
      z.object({
        risk_code: z.string().describe("Kod z katalogu R01–R15"),
        title: z.string(),
        signal: z.string(),
        cause: z.string().describe("Przyczyna według dokumentu; 'brak danych', jeśli nie podano"),
        impact: z.string(),
        mitigation: z.string().describe("Działanie zaradcze lub zapis umowny dla kolejnych inwestycji"),
        delay_days: z.number().nullable(),
        cost_pln: z.number().nullable(),
        quote: z.string().describe("DOSŁOWNY fragment dokumentu"),
        page: z.number(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .describe("Nowe zdarzenia ryzyka wynikające z dokumentu, których nie ma jeszcze w sprawie (puste, jeśli brak)"),
});

export type DocumentFindingsOutput = z.infer<typeof documentFindingsSchema>;

const pln = (v: number | null) => (v == null ? "brak" : `${Number(v).toLocaleString("pl-PL")} zł`);

/** Analiza dokumentu eksperta względem danych sprawy (BZP) + zapis ustaleń i propozycji zdarzeń do weryfikacji. */
export async function analyzeDocument(documentId: string, model = llmConfig.model) {
  const supabase = db();
  const { data: doc } = await supabase.from("rm_documents").select("*").eq("id", documentId).maybeSingle();
  if (!doc) throw new Error("Nie znaleziono dokumentu.");
  const [{ data: source }, { data: project }, { data: catalog }] = await Promise.all([
    supabase.from("rm_sources").select("id,raw").eq("id", doc.source_id).single(),
    supabase.from("rm_projects").select("id,title,beneficiary_name,record_scope").eq("id", doc.project_id).single(),
    supabase.from("rm_risk_catalog").select("*").eq("approved", true).order("code"),
  ]);
  const pages: string[] = (source?.raw as { pages?: string[] } | null)?.pages ?? [];

  // Dane sprawy: umowy zatwierdzonego dopasowania (lub wskazana umowa), zmiany, istniejące zdarzenia.
  const { data: procs } = await supabase.from("rm_procurements").select("id").eq("project_id", doc.project_id).eq("status", "accepted");
  const procIds = (procs ?? []).map((p) => p.id as string);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const { data: contractsAll } = await supabase.from("rm_contracts").select("*").in("procurement_id", procIds.length ? procIds : none);
  const contracts = ((contractsAll ?? []) as Contract[]).filter((c) => !doc.contract_id || c.id === doc.contract_id);
  const contractIds = contracts.map((c) => c.id);
  const [{ data: changes }, { data: events }] = await Promise.all([
    supabase.from("rm_contract_changes").select("*").in("contract_id", contractIds.length ? contractIds : none),
    supabase.from("rm_risk_events").select("risk_code,title").eq("project_id", doc.project_id).neq("status", "rejected"),
  ]);

  const facts = contracts.length
    ? contracts
        .map(
          (c) =>
            `Umowa${c.part_no > 0 && c.part_no < 100 ? ` (część ${c.part_no})` : ""}: wykonawca ${c.contractor_name ?? "?"}, zawarta ${c.signed_at ?? "?"}, wartość ${pln(c.initial_value)}, ` +
            `pierwotny termin ${c.planned_end ?? "?"}, wykonanie ${c.actual_end ?? "brak danych"}, wypłacono ${pln(c.paid_total)}.`,
        )
        .join("\n")
    : "Brak odtworzonej umowy (np. dopasowanie niepotwierdzone).";
  const changeLines = ((changes ?? []) as ContractChange[]).map((c) => `- zmiana ${c.change_no ?? "?"}: ${c.legal_basis ?? ""}; ${c.reason ?? ""}; wartość ${pln(c.value_change)}`).join("\n");
  const eventLines = (events ?? []).map((e) => `- ${e.risk_code}: ${e.title}`).join("\n");

  const selected = selectRelevantPages(pages, Math.min(llmConfig.maxInputChars, 12000));
  const catalogText = ((catalog ?? []) as CatalogEntry[]).map((c) => `${c.code} ${c.name}`).join("\n");

  const system = `Jesteś analitykiem inwestycji publicznych (wod-kan, Pzp). Ekspert dodał dokument do istniejącej sprawy.
Porównaj dokument z danymi sprawy (z BZP) i wskaż, co dokument POTWIERDZA, co UZUPEŁNIA (nowe informacje, np. przyczyna zmiany) i gdzie się RÓŻNI.
Zasady:
- Każde ustalenie i zdarzenie musi mieć DOSŁOWNY cytat z dokumentu oraz numer strony ze znacznika [str. N].
- Nie zgaduj: jeśli dokument czegoś nie mówi, nie twórz ustalenia.
- Zdarzenia ryzyka proponuj tylko, jeśli dokument wnosi coś nowego względem istniejących zdarzeń.
- Kwoty brutto, daty w formacie RRRR-MM-DD. Odpowiadaj po polsku.
Katalog ryzyk:
${catalogText}`;

  const prompt = `Sprawa ${project?.id}: ${project?.title} (${project?.beneficiary_name}).
Rodzaj dokumentu wskazany przez eksperta: ${doc.doc_type}. Plik: ${doc.file_name}.

Dane sprawy (z BZP):
${facts}
Zmiany umowy:
${changeLines || "brak informacji"}
Istniejące zdarzenia ryzyka:
${eventLines || "brak"}

Dokument (strony ${selected.used.join(", ")} z ${selected.total}):
${selected.text}`;

  const result = await runTask({ task: "document_findings", promptVersion: DOC_PROMPT_VERSION, system, prompt, schema: documentFindingsSchema, projectId: doc.project_id }, model);
  if (!result.output) {
    await supabase.from("rm_documents").update({ status: "error", error: result.error, llm_run_id: result.runId, updated_at: new Date().toISOString() }).eq("id", documentId);
    throw new Error(result.error ?? "Model nie zwrócił wyniku.");
  }
  const out = result.output;

  // Weryfikacja cytatu na wskazanej stronie (a gdy model pomylił stronę — w całym dokumencie, z poprawką numeru).
  const locate = (quote: string, page: number) => {
    if (pages[page - 1] && quoteFound(pages[page - 1], quote)) return { page, verified: true };
    const found = pages.findIndex((p) => quoteFound(p, quote));
    return found >= 0 ? { page: found + 1, verified: true } : { page: page || null, verified: false };
  };

  // Ponowna analiza: zastępujemy tylko nieocenione propozycje z tego dokumentu (decyzje eksperta zostają).
  await supabase.from("rm_document_findings").delete().eq("document_id", documentId).eq("status", "proposed");
  await supabase.from("rm_risk_events").delete().eq("source_id", doc.source_id).eq("origin", "llm").eq("status", "proposed");

  // Kontrola bez AI: „potwierdza” z kwotą, której nie ma wśród wartości z BZP, to w rzeczywistości rozbieżność.
  const amounts = (text: string | null) =>
    [...(text ?? "").matchAll(/\d{1,3}(?:[ \u00a0]\d{3})+(?:,\d{2})?|\d{4,}(?:[.,]\d{2})?/g)].map((m) => Number(m[0].replace(/[ \u00a0]/g, "").replace(",", ".")));
  const kindChecked = (f: DocumentFindingsOutput["findings"][number]) => {
    if (f.kind !== "confirms") return { kind: f.kind, note: "" };
    const docAmounts = amounts(f.doc_value);
    const current = amounts(f.current_value);
    if (docAmounts.length && current.length && !docAmounts.some((d) => current.some((c) => Math.abs(c - d) < 1))) {
      return { kind: "conflicts" as const, note: " (system: kwota w dokumencie różni się od danych z BZP)" };
    }
    return { kind: f.kind, note: "" };
  };

  const findingRows = out.findings.map((f) => {
    const loc = locate(f.quote, f.page);
    const checked = kindChecked(f);
    return {
      document_id: documentId,
      project_id: doc.project_id,
      kind: checked.kind,
      topic: f.topic,
      statement: f.statement + checked.note,
      doc_value: f.doc_value,
      current_value: f.current_value,
      quote: f.quote,
      page: loc.page,
      quote_verified: loc.verified,
      confidence: Math.round((loc.verified ? f.confidence : f.confidence * 0.5) * 100) / 100,
    };
  });
  if (findingRows.length) {
    const { error } = await supabase.from("rm_document_findings").insert(findingRows);
    if (error) throw new Error(`Zapis ustaleń: ${error.message}`);
  }

  const eventRows = out.events.map((e) => {
    const loc = locate(e.quote, e.page);
    return {
      project_id: doc.project_id,
      contract_id: contracts[0]?.id ?? null,
      risk_code: e.risk_code,
      title: e.title,
      signal: e.signal,
      cause: e.cause,
      impact: e.impact,
      mitigation: e.mitigation,
      delay_days: e.delay_days == null ? null : Math.round(e.delay_days),
      cost_pln: e.cost_pln,
      quote: e.quote,
      page: loc.page,
      source_id: doc.source_id,
      confidence: Math.round((loc.verified ? e.confidence : e.confidence * 0.5) * 100) / 100,
      origin: "llm",
      llm_run_id: result.runId,
      quote_verified: loc.verified,
      status: "proposed",
    };
  });
  if (eventRows.length) {
    const { error } = await supabase.from("rm_risk_events").insert(eventRows);
    if (error) throw new Error(`Zapis zdarzeń: ${error.message}`);
  }

  await supabase
    .from("rm_documents")
    .update({ status: "analyzed", summary: out.summary, error: null, llm_run_id: result.runId, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  const count = (k: string) => findingRows.filter((f) => f.kind === k).length;
  return {
    cached: result.cached,
    costUsd: result.costUsd,
    confirms: count("confirms"),
    adds: count("adds"),
    conflicts: count("conflicts"),
    events: eventRows.length,
    pagesUsed: selected.used.length,
    pagesTotal: selected.total,
  };
}
