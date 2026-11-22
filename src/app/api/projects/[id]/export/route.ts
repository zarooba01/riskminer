import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { buildProjectRecord, projectRecordMarkdown } from "@/lib/rm/project-export";
import { getCatalog, getProject } from "@/lib/rm/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/<id>/export?format=json|md — pełny rekord inwestycji: dane z importu, dopasowanie do BZP,
 * ogłoszenia, umowy (koszt, termin), zmiany umów, zdarzenia ryzyka z cytatem i źródłem, źródła dodatkowe.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/projects/[id]/export">) {
  await requireUser();
  const { id } = await params;
  const [detail, catalog] = await Promise.all([getProject(id), getCatalog()]);
  if (!detail) return NextResponse.json({ error: "Nie znaleziono inwestycji." }, { status: 404 });
  const record = buildProjectRecord(detail, catalog);
  const name = `riskminer_rekord_${id}_${new Date().toISOString().slice(0, 10)}`;
  if (new URL(request.url).searchParams.get("format") === "md") {
    return new NextResponse(projectRecordMarkdown(record), {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.md"` },
    });
  }
  return new NextResponse(JSON.stringify(record, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
  });
}
