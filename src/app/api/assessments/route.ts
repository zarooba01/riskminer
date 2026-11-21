import { NextResponse } from "next/server";

import { createAssessment, storeAssessmentDocument } from "@/lib/assess/run";
import { requireUser } from "@/lib/auth/session";
import { plural } from "@/lib/rm/format";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const number = (form: FormData, key: string) => {
  const raw = text(form, key).replace(/\s/g, "").replace(",", ".");
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * POST /api/assessments — nowa ocena inwestycji (multipart: description, title?, subsector_main?, works_type?, province?,
 * length_km?, budget_pln?, duration_months?, local_conditions?, file[] — do 5 plików PDF/DOCX). Zwraca id; liczenie: POST /api/assessments/<id>/run.
 */
export async function POST(request: Request) {
  await requireUser();
  try {
    const form = await request.formData();
    const description = text(form, "description");
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (!description && !files.length) return NextResponse.json({ ok: false, message: "Opisz planowaną inwestycję albo dołącz dokument." }, { status: 400 });
    if (files.length > 5) return NextResponse.json({ ok: false, message: "Najwyżej 5 plików w jednej ocenie." }, { status: 400 });
    const lengthKm = number(form, "length_km");
    const title = text(form, "title") || (description ? description.replace(/\s+/g, " ").slice(0, 90) : files[0].name);
    const id = await createAssessment({
      title,
      description,
      mode: text(form, "mode") === "ai" ? "ai" : "deterministic",
      params: {
        subsector_main: text(form, "subsector_main") || null,
        works_type: text(form, "works_type") || null,
        province: text(form, "province") || null,
        length_m: lengthKm ? Math.round(lengthKm * 1000) : null,
        budget_pln: number(form, "budget_pln"),
        duration_months: number(form, "duration_months"),
        local_conditions: text(form, "local_conditions") || null,
      },
    });
    let message = "Zapisano opis inwestycji.";
    if (files.length) {
      const sourceIds: string[] = [];
      const read: string[] = [];
      try {
        for (const file of files) {
          const stored = await storeAssessmentDocument(id, file);
          sourceIds.push(stored.sourceId);
          const unit: [string, string, string] = stored.kind === "pdf" ? ["strona", "strony", "stron"] : ["fragment", "fragmenty", "fragmentów"];
          read.push(`${file.name} (${plural(stored.pages, unit)})`);
        }
        await db().from("rm_assessments").update({ document_source_ids: sourceIds }).eq("id", id);
        message = `Odczytano ${plural(files.length, ["dokument", "dokumenty", "dokumentów"])}: ${read.join(", ")}.`;
      } catch (error) {
        if (sourceIds.length) await db().from("rm_sources").delete().in("id", sourceIds);
        await db().from("rm_assessments").delete().eq("id", id);
        throw error;
      }
    }
    return NextResponse.json({ ok: true, id, message });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
