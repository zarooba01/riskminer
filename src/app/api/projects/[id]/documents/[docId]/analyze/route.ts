import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { analyzeDocument } from "@/lib/llm/tasks/document-findings";
import { withChangeReport } from "@/lib/rm/change-report";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/projects/<id>/documents/<docId>/analyze — porównanie dokumentu z danymi sprawy (AI). */
export async function POST(_: Request, { params }: RouteContext<"/api/projects/[id]/documents/[docId]/analyze">) {
  await requireUser();
  const { id, docId } = await params;
  try {
    const r = await withChangeReport(id, "Analiza dodanego dokumentu", () => analyzeDocument(docId));
    revalidatePath("/", "layout");
    const cost = r.cached ? "z pamięci podręcznej (0 USD)" : `koszt ${r.costUsd?.toFixed(5) ?? "?"} USD`;
    return NextResponse.json({
      ok: true,
      ...r,
      message: `Potwierdza: ${r.confirms}, uzupełnia: ${r.adds}, rozbieżności: ${r.conflicts}; nowe zdarzenia: ${r.events}. Przeanalizowano ${r.pagesUsed} z ${r.pagesTotal} stron, ${cost}.`,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
