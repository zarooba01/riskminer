import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { documentTypes, storeDocument } from "@/lib/ingest/documents";
import { plural } from "@/lib/rm/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/projects/<id>/documents — dodanie PDF/DOCX do inwestycji (multipart: file, doc_type, contract_id). */
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/documents">) {
  await requireUser();
  const { id } = await params;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, message: "Wybierz plik PDF lub DOCX." }, { status: 400 });
    const docType = String(form.get("doc_type") ?? "inny");
    const contractId = String(form.get("contract_id") ?? "") || null;
    const stored = await storeDocument({ projectId: id, contractId, docType: (documentTypes as readonly string[]).includes(docType) ? docType : "inny", file });
    const unit: [string, string, string] = stored.kind === "pdf" ? ["stronę", "strony", "stron"] : ["fragment", "fragmenty", "fragmentów"];
    return NextResponse.json({ ok: true, ...stored, message: `Odczytano ${plural(stored.pages, unit)}, ${plural(stored.chars, ["znak", "znaki", "znaków"])}.` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
