import { NextResponse } from "next/server";

import { importProjects } from "@/lib/rm/actions";

export const dynamic = "force-dynamic";

/** POST /api/import — import zestawu organizatora (albo pliku w polu `file`, multipart). */
export async function POST(request: Request) {
  const form = request.headers.get("content-type")?.includes("multipart") ? await request.formData() : new FormData();
  const result = await importProjects(null, form);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
