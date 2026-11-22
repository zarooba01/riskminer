"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";

import type { ParamInput } from "@/lib/assess/params";
import { buildReferenceBase } from "@/lib/assess/reference";
import { runAssessment } from "@/lib/assess/run";
import { requireUser } from "@/lib/auth/session";
import { withChangeReport } from "@/lib/rm/change-report";
import { assignProcurement, buildProjectRecords, dropUnconfirmedEvents, enrichProject } from "@/lib/ingest/enrich";
import { normalizeNip, normalizeNoticeNumber } from "@/lib/ingest/bzp";
import { projectColumns } from "@/lib/ingest/columns";
import { parseProjectsFile, rowsFromTable, type ProjectRow } from "@/lib/ingest/xlsx";
import { llmConfig } from "@/lib/llm/config";
import { analyzeProjectRisks } from "@/lib/llm/tasks/risk-events";
import { db } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string };

const fail = (error: unknown): ActionResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) });

/** Import pliku XLSX (wgranego albo dołączonego zestawu organizatora). Upsert po identyfikatorze rekordu. */
export async function importProjects(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  try {
    const file = formData.get("file");
    let buffer: ArrayBuffer;
    let name: string;
    if (file instanceof File && file.size > 0) {
      buffer = await file.arrayBuffer();
      name = file.name;
    } else {
      const bundled = await readFile(path.join(process.cwd(), "data/Risk_Miner_dane_projekty.xlsx"));
      buffer = bundled.buffer.slice(bundled.byteOffset, bundled.byteOffset + bundled.byteLength) as ArrayBuffer;
      name = "Risk_Miner_dane_projekty.xlsx (dane startowe)";
    }

    const { rows, warnings } = await parseProjectsFile(buffer, name.replace(/ \(.*\)$/, ""));
    const supabase = db();
    const { data: source, error: sourceError } = await supabase
      .from("rm_sources")
      .upsert({ kind: "xlsx", external_id: name, title: `Plik ${name}`, fetched_at: new Date().toISOString(), raw: { rows: rows.length, warnings } }, { onConflict: "kind,external_id" })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);

    const { error } = await supabase
      .from("rm_projects")
      .upsert(rows.map((r) => ({ ...r, source_id: source.id, updated_at: new Date().toISOString() })), { onConflict: "id" });
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    return { ok: true, message: `Zaimportowano ${rows.length} inwestycji.${warnings.length ? ` Uwagi: ${warnings.join(" ")}` : ""}` };
  } catch (error) {
    return fail(error);
  }
}

export type AddProjectsResult = ActionResult & {
  added: string[];
  skipped: { id: string; title: string; reason: string }[];
  warnings: string[];
};

/** Klucz biznesowy rekordu: znormalizowany identyfikator publiczny (BZP / KPO) + zakres (całe postępowanie / część N). */
function businessKey(publicId: string | null, scope: string | null): string | null {
  if (!publicId) return null;
  const id = normalizeNoticeNumber(publicId) ?? publicId.replace(/\s+/g, "").toUpperCase();
  return `${id}|${(scope ?? "całe postępowanie").trim().toLowerCase()}`;
}

/** Podział rekordów na nowe i duplikaty (względem bazy i wcześniejszych rekordów z tej samej partii). */
async function splitDuplicates(rows: ProjectRow[]) {
  const { data: existing } = await db().from("rm_projects").select("id,public_id,record_scope");
  const byId = new Set((existing ?? []).map((p) => p.id as string));
  const byKey = new Map<string, string>();
  for (const p of existing ?? []) {
    const key = businessKey(p.public_id, p.record_scope);
    if (key) byKey.set(key, p.id);
  }
  const toInsert: ProjectRow[] = [];
  const skipped: AddProjectsResult["skipped"] = [];
  for (const row of rows) {
    const key = businessKey(row.public_id, row.record_scope);
    if (byId.has(row.id)) {
      skipped.push({ id: row.id, title: row.title, reason: `identyfikator ${row.id} już istnieje w bazie` });
    } else if (key && byKey.has(key)) {
      skipped.push({ id: row.id, title: row.title, reason: `ten sam identyfikator publiczny (${row.public_id_type ?? "—"}: ${normalizeNoticeNumber(row.public_id ?? "") ?? row.public_id}, ${row.record_scope ?? "całe postępowanie"}) jest już w bazie jako ${byKey.get(key)}` });
    } else {
      toInsert.push(row);
      byId.add(row.id);
      if (key) byKey.set(key, row.id);
    }
  }
  return { toInsert, skipped };
}

export type AddProjectResult = ActionResult & { projectId?: string; fieldErrors?: Partial<Record<string, string>> };

/**
 * Dodanie jednego projektu z formularza. Pola formularza mają nazwy nagłówków z szablonu (projectColumns),
 * więc walidacja, normalizacja i klasyfikacja są te same co przy imporcie pliku.
 */
export async function addProject(formData: FormData): Promise<AddProjectResult> {
  await requireUser();
  try {
    const headers = projectColumns.filter((c) => c.field).map((c) => c.header);
    const values = headers.map((h) => String(formData.get(h) ?? "").trim());
    const get = (header: string) => values[headers.indexOf(header)] ?? "";

    const fieldErrors: Record<string, string> = {};
    if (!get("Identyfikator rekordu")) fieldErrors["Identyfikator rekordu"] = "Podaj identyfikator rekordu.";
    else if (!/^[\w.\-/]{3,40}$/.test(get("Identyfikator rekordu"))) fieldErrors["Identyfikator rekordu"] = "Dozwolone litery, cyfry, - . / _ (3–40 znaków).";
    if (!get("Nazwa przedsięwzięcia")) fieldErrors["Nazwa przedsięwzięcia"] = "Podaj nazwę przedsięwzięcia.";
    if (get("Identyfikator odbiorcy") && !normalizeNip(get("Identyfikator odbiorcy"))) fieldErrors["Identyfikator odbiorcy"] = "NIP nie przechodzi walidacji sumy kontrolnej.";
    if (get("Rodzaj identyfikatora publicznego") === "Ogłoszenie BZP" && get("Identyfikator publiczny") && !normalizeNoticeNumber(get("Identyfikator publiczny")))
      fieldErrors["Identyfikator publiczny"] = "Numer BZP w formacie RRRR/BZP NNNNNNNN/WW, np. 2022/BZP 00058537/01.";
    if (Object.keys(fieldErrors).length) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors };

    const { rows } = rowsFromTable(headers, [values]);
    const { toInsert, skipped } = await splitDuplicates(rows);
    if (!toInsert.length) {
      const reason = skipped[0]?.reason ?? "rekord już istnieje";
      const field = reason.startsWith("identyfikator") ? "Identyfikator rekordu" : "Identyfikator publiczny";
      return { ok: false, message: `Nie dodano: ${reason}.`, fieldErrors: { [field]: reason } };
    }

    const row = toInsert[0];
    const supabase = db();
    const { data: source, error: sourceError } = await supabase
      .from("rm_sources")
      .insert({ kind: "manual", external_id: `formularz#${row.id}#${new Date().toISOString()}`, title: `Formularz: ${row.id}`, fetched_at: new Date().toISOString(), raw: Object.fromEntries(headers.map((h, i) => [h, values[i]])) })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);
    const { error } = await supabase.from("rm_projects").insert({ ...row, source_id: source.id });
    if (error) throw new Error(error.message);
    await supabase.from("rm_decisions").insert({ entity: "project", entity_id: row.id, action: "add_project", after: row });

    revalidatePath("/", "layout");
    return { ok: true, message: `Dodano projekt ${row.id}.`, projectId: row.id };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Dodanie projektów z pliku XLSX — tylko nowe rekordy. Duplikat = ten sam identyfikator rekordu
 * albo ten sam identyfikator publiczny (BZP/KPO) z tym samym zakresem, w bazie lub wcześniej w tym samym pliku.
 */
export async function addProjects(_: AddProjectsResult | null, formData: FormData): Promise<AddProjectsResult> {
  await requireUser();
  const empty = { added: [], skipped: [], warnings: [] };
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Wybierz plik .xlsx lub .csv.", ...empty };
    if (!/\.(xlsx|csv)$/i.test(file.name)) return { ok: false, message: "Obsługiwane formaty: .xlsx i .csv (układ jak w szablonie).", ...empty };

    const { rows, warnings } = await parseProjectsFile(await file.arrayBuffer(), file.name);
    if (!rows.length) return { ok: false, message: "Nie znaleziono rekordów — sprawdź, czy plik ma kolumny „Identyfikator rekordu” i „Nazwa przedsięwzięcia”.", ...empty, warnings };

    const supabase = db();
    const { toInsert, skipped } = await splitDuplicates(rows);

    if (toInsert.length) {
      const { data: source, error: sourceError } = await supabase
        .from("rm_sources")
        .upsert({ kind: "xlsx", external_id: `${file.name}#${new Date().toISOString()}`, title: `Plik ${file.name}`, fetched_at: new Date().toISOString(), raw: { rows: rows.length, added: toInsert.length, skipped: skipped.length, warnings } }, { onConflict: "kind,external_id" })
        .select("id")
        .single();
      if (sourceError) throw new Error(sourceError.message);
      const { error } = await supabase.from("rm_projects").insert(toInsert.map((r) => ({ ...r, source_id: source.id })));
      if (error) throw new Error(error.message);
      await supabase.from("rm_decisions").insert({ entity: "import", entity_id: file.name, action: "add_projects", after: { added: toInsert.map((r) => r.id), skipped } });
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: toInsert.length ? `Dodano ${toInsert.length} z ${rows.length} rekordów.${skipped.length ? ` Pominięto duplikaty: ${skipped.length}.` : ""}` : `Wszystkie rekordy (${rows.length}) już są w bazie — nic nie dodano.`,
      added: toInsert.map((r) => r.id),
      skipped,
      warnings,
    };
  } catch (error) {
    return { ...fail(error), ...empty };
  }
}

export async function enrichProjectAction(projectId: string): Promise<ActionResult & { notices?: number; events?: number }> {
  await requireUser();
  try {
    const result = await withChangeReport(projectId, "Ponowne wzbogacenie (BZP i źródła dodatkowe)", () => enrichProject(projectId));
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${projectId}: postępowań ${result.procurements}, ogłoszeń ${result.notices}, zmian umowy ${result.changes}, zdarzeń z reguł ${result.events}.`,
      notices: result.notices,
      events: result.events,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function analyzeProjectAction(projectId: string): Promise<ActionResult> {
  await requireUser();
  try {
    const result = await withChangeReport(projectId, `Analiza AI (${llmConfig.model})`, () => analyzeProjectRisks(projectId));
    revalidatePath("/", "layout");
    const cost = result.cached ? "wynik z pamięci podręcznej (0 USD)" : `koszt ${result.costUsd?.toFixed(5) ?? "?"} USD`;
    return { ok: true, message: `Model ${llmConfig.model}: ${result.saved} propozycji zdarzeń do weryfikacji, ${cost}.` };
  } catch (error) {
    return fail(error);
  }
}

type Decision = "accept" | "reject" | "reopen";

/** Rekord zniknął (np. dane odświeżono w innej karcie) — zamiast błędu bazy przeładowujemy widok. */
const gone = (what: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: false, message: `${what} już nie istnieje — dane zostały odświeżone. Widok przeładowano, spróbuj ponownie.` };
};
const statusFor: Record<Decision, string> = { accept: "accepted", reject: "rejected", reopen: "proposed" };

async function logDecision(entity: string, entityId: string, action: string, before: unknown, after: unknown, comment?: string) {
  await db().from("rm_decisions").insert({ entity, entity_id: entityId, action, before, after, comment: comment || null });
}

export async function decideRiskEvent(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_risk_events").select("*").eq("id", id).maybeSingle();
    if (!before) return gone("To zdarzenie");
    const { data: after, error } = await supabase
      .from("rm_risk_events")
      .update({ status: statusFor[decision], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logDecision("risk_event", id, decision, before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "accept" ? "Zatwierdzono." : decision === "reject" ? "Odrzucono." : "Przywrócono do weryfikacji." };
  } catch (error) {
    return fail(error);
  }
}

export type RiskEventPatch = {
  risk_code: string;
  title: string;
  cause: string;
  impact: string;
  mitigation: string;
  delay_days: number | null;
  cost_pln: number | null;
};

export async function editRiskEvent(id: string, patch: RiskEventPatch, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_risk_events").select("*").eq("id", id).maybeSingle();
    if (!before) return gone("To zdarzenie");
    const { data: after, error } = await supabase
      .from("rm_risk_events")
      .update({ ...patch, status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logDecision("risk_event", id, "edit", before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: "Zapisano poprawki i zatwierdzono." };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleExemplary(id: string, exemplary: boolean): Promise<ActionResult> {
  await requireUser();
  try {
    const { data: updated } = await db().from("rm_risk_events").update({ exemplary }).eq("id", id).select("id");
    if (!updated?.length) return gone("To zdarzenie");
    await logDecision("risk_event", id, exemplary ? "exemplary" : "not_exemplary", null, { exemplary });
    revalidatePath("/", "layout");
    return { ok: true, message: exemplary ? "Oznaczono jako wzorcowy przykład dla modelu." : "Usunięto oznaczenie wzorcowe." };
  } catch (error) {
    return fail(error);
  }
}

export async function decideProcurement(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_procurements").select("*").eq("id", id).maybeSingle();
    if (!before) return gone("To dopasowanie");
    const { data: after, error } = await supabase.from("rm_procurements").update({ status: statusFor[decision] }).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await logDecision("procurement", id, decision, before, after, comment);
    // Wzbogacenie dopiero po potwierdzeniu; odrzucenie / przywrócenie usuwa propozycje zdarzeń z tego przetargu.
    let extra = "";
    if (decision === "accept") {
      const built = await withChangeReport(before.project_id, "Potwierdzenie dopasowania do przetargu", () => buildProjectRecords(before.project_id));
      extra = built.contracts ? ` Wzbogacono: umów ${built.contracts}, zdarzeń ${built.events}.` : " Brak ogłoszeń o umowie w BZP.";
    } else {
      await dropUnconfirmedEvents([id]);
    }
    revalidatePath("/", "layout");
    return { ok: true, message: (decision === "accept" ? "Dopasowanie zatwierdzone." : decision === "reject" ? "Dopasowanie odrzucone." : "Przywrócono do weryfikacji.") + extra };
  } catch (error) {
    return fail(error);
  }
}

export async function decideCatalog(code: string, approved: boolean): Promise<ActionResult> {
  await requireUser();
  try {
    await db().from("rm_risk_catalog").update({ approved, updated_at: new Date().toISOString() }).eq("code", code);
    await logDecision("catalog", code, approved ? "accept" : "reject", null, { approved });
    revalidatePath("/", "layout");
    return { ok: true, message: approved ? `Kategoria ${code} zatwierdzona.` : `Kategoria ${code} wyłączona.` };
  } catch (error) {
    return fail(error);
  }
}

/** Ręczne wskazanie przetargu dla projektu (modyfikacja połączenia przez eksperta). */
export async function assignProcurementAction(projectId: string, noticeNumber: string, add = false): Promise<ActionResult> {
  await requireUser();
  try {
    const r = await withChangeReport(projectId, add ? "Dodanie kolejnego zamówienia" : "Zmiana dopasowania do przetargu", () => assignProcurement(projectId, noticeNumber, add));
    await db().from("rm_decisions").insert({
      entity: "procurement",
      entity_id: projectId,
      action: add ? "assign_additional" : "assign",
      after: { bzp_number: r.bzpNumber, title: r.title, rejected_previous: r.rejected },
    });
    revalidatePath("/", "layout");
    const warn = r.nipOk ? "" : " Uwaga: NIP zamawiającego różni się od NIP w projekcie.";
    return { ok: true, message: `${add ? "Dodano kolejne zamówienie" : "Przypisano"} ${r.bzpNumber}: ogłoszeń ${r.notices}, umów ${r.contracts}, zdarzeń ${r.events}.${warn}` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Wyczyszczenie danych projektów (projekty, dopasowania, ogłoszenia, umowy, zmiany, zdarzenia, źródła, przebiegi AI,
 * historia decyzji). Katalog ryzyk zostaje. Po wyczyszczeniu zapisujemy jeden wpis w historii — kto i ile usunął.
 */
export async function clearProjectData(): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { count: projects } = await supabase.from("rm_projects").select("*", { count: "exact", head: true });
    // Kolejność: od tabel zależnych do nadrzędnych (bez polegania na kaskadach).
    const tables = ["rm_risk_events", "rm_contract_changes", "rm_contracts", "rm_notices", "rm_procurements", "rm_projects", "rm_llm_runs", "rm_decisions", "rm_sources"];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().not("created_at", "is", null);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    await supabase.from("rm_decisions").insert({ entity: "system", entity_id: "all", action: "clear_data", after: { projects: projects ?? 0 } });
    revalidatePath("/", "layout");
    return { ok: true, message: `Usunięto dane ${projects ?? 0} inwestycji. Katalog ryzyk został bez zmian.` };
  } catch (error) {
    return fail(error);
  }
}

/** Decyzja eksperta o ustaleniu z dokumentu (potwierdza / uzupełnia / rozbieżność). Dane z BZP nie są nadpisywane. */
export async function decideFinding(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_document_findings").select("*").eq("id", id).maybeSingle();
    if (!before) return gone("To ustalenie");
    const { data: after, error } = await supabase
      .from("rm_document_findings")
      .update({ status: statusFor[decision], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logDecision("document_finding", id, decision, before, after, comment);
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "accept" ? "Ustalenie zatwierdzone." : decision === "reject" ? "Ustalenie odrzucone." : "Przywrócono do weryfikacji." };
  } catch (error) {
    return fail(error);
  }
}

/* ───────────── Ocena nowej inwestycji ───────────── */

/** Przeliczenie oceny na aktualnej bazie (nowe projekty, decyzje eksperta) — bez AI, koszt 0. */
export async function rerunAssessment(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    const r = await runAssessment(id);
    revalidatePath(`/assessments/${id}`);
    revalidatePath("/assessments");
    return { ok: true, message: `Zaktualizowano ocenę: ${r.considered} przypadków, w statystyce ${r.included}. Decyzje eksperta zachowane.` };
  } catch (error) {
    return fail(error);
  }
}

/** Zmiana założeń oceny (parametry, wagi cech, liczba przypadków) i przeliczenie. */
export async function updateAssessmentParams(id: string, input: ParamInput): Promise<ActionResult> {
  await requireUser();
  try {
    const r = await runAssessment(id, input);
    await logDecision("assessment", id, "edit_params", null, input);
    revalidatePath(`/assessments/${id}`);
    revalidatePath("/assessments");
    return { ok: true, message: `Zapisano założenia i przeliczono: ${r.considered} przypadków, w statystyce ${r.included}.` };
  } catch (error) {
    return fail(error);
  }
}

/** Decyzja eksperta o pozycji oceny (ryzyko, zalecenie, flaga). Przetrwa aktualizację oceny (stały klucz pozycji). */
export async function decideAssessmentItem(id: string, decision: Decision, comment?: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data: before } = await supabase.from("rm_assessment_items").select("*").eq("id", id).maybeSingle();
    if (!before) return gone("Ta pozycja");
    const { data: after, error } = await supabase
      .from("rm_assessment_items")
      .update({ status: statusFor[decision], updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logDecision("assessment_item", id, decision, before, after, comment);
    revalidatePath(`/assessments/${before.assessment_id}`);
    return { ok: true, message: decision === "accept" ? "Zatwierdzono." : decision === "reject" ? "Odrzucono." : "Przywrócono do weryfikacji." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  await requireUser();
  try {
    const supabase = db();
    const { data } = await supabase.from("rm_assessments").select("title,document_source_ids").eq("id", id).maybeSingle();
    if (!data) return gone("Ta ocena");
    await supabase.from("rm_assessments").delete().eq("id", id);
    if (data.document_source_ids?.length) {
      // Oryginały dokumentów planu w prywatnym Storage też usuwamy (nie należą do żadnego projektu z bazy).
      const { data: docs } = await supabase.from("rm_sources").select("raw").in("id", data.document_source_ids);
      const paths = (docs ?? []).map((d) => (d.raw as { storage_path?: string } | null)?.storage_path).filter((x): x is string => Boolean(x));
      if (paths.length) await supabase.storage.from("rm-documents").remove(paths);
      await supabase.from("rm_sources").delete().in("id", data.document_source_ids);
    }
    await logDecision("assessment", id, "delete", { title: data.title }, null);
    revalidatePath("/assessments");
    return { ok: true, message: `Usunięto ocenę „${data.title}”.` };
  } catch (error) {
    return fail(error);
  }
}

/** Edycja wiedzy eksperckiej kategorii: co sprawdzić, działania, zapisy umowne (zasila oceny nowych inwestycji). */
export async function editCatalogGuidance(code: string, patch: { checks: string[]; actions: string[]; clauses: string[] }): Promise<ActionResult> {
  await requireUser();
  try {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    const supabase = db();
    const { data: before } = await supabase.from("rm_risk_catalog").select("code,checks,actions,clauses").eq("code", code).maybeSingle();
    if (!before) return gone("Ta kategoria");
    const after = { checks: clean(patch.checks), actions: clean(patch.actions), clauses: clean(patch.clauses) };
    const { error } = await supabase.from("rm_risk_catalog").update({ ...after, updated_at: new Date().toISOString() }).eq("code", code);
    if (error) throw new Error(error.message);
    await logDecision("catalog", code, "edit_guidance", before, after);
    revalidatePath("/", "layout");
    return { ok: true, message: `Zapisano wiedzę ekspercką ${code}. Zadziała przy następnej aktualizacji ocen.` };
  } catch (error) {
    return fail(error);
  }
}

/** (Od)budowa bazy porównawczej do ocen — kopia zakończonych projektów z automatycznie zaakceptowanymi danymi. */
export async function rebuildReferenceBase(): Promise<ActionResult> {
  await requireUser();
  try {
    const r = await buildReferenceBase();
    revalidatePath("/reference");
    return { ok: true, message: `Baza porównawcza: ${r.cases} inwestycji, ${r.events} zaakceptowanych zdarzeń. Oryginały bez zmian. Zaktualizuj oceny, żeby użyć nowej bazy.` };
  } catch (error) {
    return fail(error);
  }
}
