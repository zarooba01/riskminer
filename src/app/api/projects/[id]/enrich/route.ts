import { NextResponse } from "next/server";

import { enrichProject } from "@/lib/ingest/enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/projects/<id>/enrich — powtarzalne wzbogacenie z BZP (do automatyzacji i monitoringu). */
export async function POST(_: Request, { params }: RouteContext<"/api/projects/[id]/enrich">) {
  const { id } = await params;
  try {
    return NextResponse.json(await enrichProject(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
