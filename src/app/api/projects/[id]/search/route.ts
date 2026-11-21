import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { runSearchStep } from "@/lib/rm/steps";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/projects/<id>/search — etap „wyszukiwanie w BZP”. Endpoint (a nie server action), bo server actions
 * wywołane z przeglądarki Next.js wykonuje po kolei, a import przetwarza kilka projektów równolegle.
 */
export async function POST(_: Request, { params }: RouteContext<"/api/projects/[id]/search">) {
  await requireUser();
  const { id } = await params;
  const result = await runSearchStep(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
