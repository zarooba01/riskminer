import { NextResponse } from "next/server";

import { assessmentMarkdown } from "@/lib/assess/markdown";
import { assessmentExport } from "@/lib/assess/queries";
import { requireUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/rm/export";

export const dynamic = "force-dynamic";

/**
 * GET /api/assessments/<id>/export?format=json|md|csv[&part=items|matches]
 * JSON — cała ocena (założenia, statystyka, przypadki, pozycje ze źródłami); Markdown — ta sama ocena jako raport do czytania;
 * CSV — pozycje albo przypadki jako tabela.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/assessments/[id]/export">) {
  await requireUser();
  const { id } = await params;
  const data = await assessmentExport(id);
  if (!data) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });
  const url = new URL(request.url);
  const stamp = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("format") === "md") {
    return new NextResponse(assessmentMarkdown(data), {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="riskminer_ocena_${id.slice(0, 8)}_${stamp}.md"` },
    });
  }
  if (url.searchParams.get("format") === "csv") {
    const part = url.searchParams.get("part") === "matches" ? "matches" : "items";
    const rows =
      part === "matches"
        ? data.matches.map(({ components, notice, ...m }) => ({
            ...m,
            components: components.map((c) => `${c.label}: ${c.points} pkt (${c.detail})`).join(" | "),
            notice_url: notice?.url ?? null,
          }))
        : data.items.map(({ support, examples, ...it }) => ({
            ...it,
            project_ids: (support?.project_ids ?? []).join(" "),
            event_ids: (support?.event_ids ?? []).join(" "),
            sources: examples.map((ex) => `${ex.project_id}: ${ex.source?.url ?? ex.source_id ?? ""} „${ex.quote ?? ""}”`).join(" | "),
          }));
    return new NextResponse("﻿" + toCsv(rows as Record<string, unknown>[]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="riskminer_ocena_${part}_${id.slice(0, 8)}_${stamp}.csv"` },
    });
  }
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="riskminer_ocena_${id.slice(0, 8)}_${stamp}.json"` },
  });
}
