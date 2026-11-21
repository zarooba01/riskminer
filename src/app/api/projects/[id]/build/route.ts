import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { runBuildStep } from "@/lib/rm/steps";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/projects/<id>/build — etap „wzbogacanie” (umowy, zmiany, zdarzenia). Równoległe wywołania, patrz /search. */
export async function POST(_: Request, { params }: RouteContext<"/api/projects/[id]/build">) {
  await requireUser();
  const { id } = await params;
  const result = await runBuildStep(id);
  if (result.ok) revalidatePath("/", "layout");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
