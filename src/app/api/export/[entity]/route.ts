import { NextResponse } from "next/server";

import { exportEntities, toCsv, type ExportEntity } from "@/lib/rm/export";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/export/<encja>?format=csv|json[&project=RM-2026-001] — rekordy do filtrowania i dalszej pracy. */
export async function GET(request: Request, { params }: RouteContext<"/api/export/[entity]">) {
  const { entity } = await params;
  const spec = exportEntities[entity as ExportEntity];
  if (!spec) return NextResponse.json({ error: "Nieznana encja." }, { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const project = url.searchParams.get("project");

  let query = db().from(spec.table).select(spec.select).limit(10000);
  if (project && ["rm_procurements", "rm_risk_events", "rm_llm_runs", "rm_documents", "rm_document_findings", "rm_external_checks", "rm_change_reports"].includes(spec.table)) query = query.eq("project_id", project);
  if (project && spec.table === "rm_projects") query = query.eq("id", project);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `riskminer_${entity}${project ? `_${project}` : ""}_${stamp}`;
  if (format === "csv") {
    return new NextResponse("﻿" + toCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` },
    });
  }
  return new NextResponse(JSON.stringify({ entity, exported_at: new Date().toISOString(), count: rows.length, rows }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
  });
}
