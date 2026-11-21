import "server-only";

import { createHash } from "node:crypto";

import { DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, readDocument } from "@/lib/ingest/documents";
import { db } from "@/lib/supabase/admin";

import { runAiAssessment } from "@/lib/llm/tasks/assessment-ai";

import { loadComparisonCases } from "./cases";
import { computeAssessment } from "./engine";
import { detectConditions, resolveParams, type ParamInput } from "./params";
import type { Assessment, AssessmentMode, AssessmentSummary, ParamKey, ParamOrigin } from "./types";

/** Tekst dokumentów dołączonych do oceny (do odczytu parametrów i podobieństwa treści). */
async function documentText(sourceIds: string[]): Promise<string> {
  if (!sourceIds.length) return "";
  const { data } = await db().from("rm_sources").select("text_content").in("id", sourceIds);
  return (data ?? []).map((s) => (s.text_content as string | null) ?? "").join("\n\n").slice(0, 40_000);
}

/** Zapis wgranego dokumentu planu (PDF/DOCX): oryginał w prywatnym Storage, tekst stron w rm_sources (rodzaj „assessment”). */
export async function storeAssessmentDocument(assessmentId: string, file: File): Promise<{ sourceId: string; pages: number; chars: number; kind: "pdf" | "docx" }> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`Plik ma ${(file.size / 1024 / 1024).toFixed(1)} MB — maksymalnie 4 MB.`);
  const buffer = await file.arrayBuffer();
  const read = await readDocument(buffer, file.name);
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const supabase = db();
  const storagePath = `assessments/${assessmentId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, Buffer.from(buffer), {
    contentType: file.type || (read.kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    upsert: false,
  });
  if (uploadError) throw new Error(`Zapis pliku: ${uploadError.message}`);
  const { data, error } = await supabase
    .from("rm_sources")
    .insert({
      kind: "assessment",
      external_id: `assessment/${assessmentId}/${file.name}#${hash.slice(0, 12)}`,
      title: `Dokument planu: ${file.name}`,
      content_hash: hash,
      raw: { pages: read.pages, kind: read.kind, file_name: file.name, storage_path: storagePath, assessment_id: assessmentId },
      text_content: read.pages.map((p, i) => `[str. ${i + 1}]\n${p}`).join("\n\n"),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis źródła: ${error.message}`);
  return { sourceId: data.id, pages: read.pages.length, chars: read.chars, kind: read.kind };
}

/** Nowa ocena: rekord z opisem i parametrami wpisanymi przez użytkownika (bez liczenia). */
export async function createAssessment(input: { title: string; description: string; params: ParamInput; mode?: AssessmentMode }): Promise<string> {
  const mode = input.mode ?? "deterministic";
  // W trybie AI parametry ustala model — reguły nie odczytują ich z opisu (zostają tylko pola wpisane przez użytkownika).
  const { params, origin } = resolveParams(mode === "ai" ? "" : input.description, input.params);
  const { data, error } = await db()
    .from("rm_assessments")
    .insert({ title: input.title, description: input.description, params, params_origin: origin, mode })
    .select("id")
    .single();
  if (error) throw new Error(`Zapis oceny: ${error.message}`);
  return data.id;
}

/**
 * Przeliczenie oceny na aktualnej bazie: parametry (wpisane > z opisu), podobne przypadki, statystyka, ryzyka i zalecenia.
 * Decyzje eksperta o pozycjach zostają (dopasowanie po stałym kluczu pozycji); wnioski AI nie są usuwane.
 * Poprzednie statystyki trafiają do summary.previous — ekran pokazuje „było → jest”.
 */
export async function runAssessment(id: string, input?: ParamInput): Promise<{ included: number; considered: number; items: number }> {
  const supabase = db();
  const { data: row } = await supabase.from("rm_assessments").select("*").eq("id", id).maybeSingle();
  if (!row) throw new Error("Nie znaleziono oceny.");
  const assessment = row as Assessment;
  // Tryb AI: bez analizy deterministycznej — przypadki i wnioski wybiera model, liczby liczymy z danych tych przypadków.
  if (assessment.mode === "ai") return runAiAssessment(id, input);
  const docText = await documentText(assessment.document_source_ids ?? []);
  const text = `${assessment.description}\n${docText}`;

  // Parametry wpisane wcześniej przez użytkownika (input/llm) zostają, chyba że przekazano nowe wartości.
  const kept: ParamInput = {};
  for (const [key, origin] of Object.entries(assessment.params_origin ?? {}) as [ParamKey, ParamOrigin][]) {
    if (origin !== "rule") (kept as Record<string, unknown>)[key] = (assessment.params as unknown as Record<string, unknown>)[key];
  }
  const merged: ParamInput = { ...kept, weights: assessment.params?.weights, top_k: assessment.params?.top_k, ...(input ?? {}) };
  // Pole zmienione teraz przez użytkownika traci oznaczenie „model AI” — staje się daną użytkownika.
  const previousOrigin = Object.fromEntries(Object.entries(assessment.params_origin ?? {}).filter(([key]) => !(input && key in input)));
  const { params, origin } = resolveParams(text, merged, previousOrigin);

  // Tylko baza porównawcza: zakończone projekty z zaakceptowanymi zdarzeniami (rm_ref_*).
  const { cases, catalog } = await loadComparisonCases();
  const detected = detectConditions(`${assessment.description}\n${params.local_conditions ?? ""}\n${docText.slice(0, 8000)}`);
  const { matches, summary, items } = computeAssessment({ params, text: `${text}\n${params.local_conditions ?? ""}`, cases, catalog: catalog.filter((c) => c.approved), detected });

  const { data: oldItems } = await supabase.from("rm_assessment_items").select("item_key,status,risk_code,basis").eq("assessment_id", id);
  const statusByKey = new Map((oldItems ?? []).map((i) => [i.item_key as string, i.status as string]));
  const prev = assessment.summary as AssessmentSummary;
  const { data: oldMatches } = await supabase.from("rm_assessment_matches").select("project_id,included").eq("assessment_id", id);
  summary.previous =
    assessment.version > 0 && prev?.generated_at
      ? {
          version: assessment.version,
          generated_at: prev.generated_at,
          included: prev.included,
          cost: prev.cost,
          delay_days: prev.delay_days,
          project_ids: (oldMatches ?? []).filter((m) => m.included).map((m) => m.project_id as string),
          risk_codes: (oldItems ?? []).filter((i) => i.basis !== "llm" && i.item_key.startsWith("risk:")).map((i) => i.risk_code as string),
        }
      : null;

  await supabase.from("rm_assessment_matches").delete().eq("assessment_id", id);
  if (matches.length) {
    const { error } = await supabase.from("rm_assessment_matches").insert(matches.map((m) => ({ ...m, assessment_id: id })));
    if (error) throw new Error(`Zapis przypadków: ${error.message}`);
  }
  // Pozycje wyliczane (bez AI) zastępujemy; wnioski AI (klucz „ai:”) zostają do decyzji eksperta.
  await supabase.from("rm_assessment_items").delete().eq("assessment_id", id).not("item_key", "like", "ai:%");
  if (items.length) {
    const { error } = await supabase
      .from("rm_assessment_items")
      .insert(items.map((it) => ({ ...it, assessment_id: id, status: statusByKey.get(it.item_key) ?? "proposed" })));
    if (error) throw new Error(`Zapis pozycji: ${error.message}`);
  }
  const { error } = await supabase
    .from("rm_assessments")
    .update({ params, params_origin: origin, summary, version: assessment.version + 1, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Zapis oceny: ${error.message}`);
  return { included: summary.included, considered: summary.considered, items: items.length };
}
