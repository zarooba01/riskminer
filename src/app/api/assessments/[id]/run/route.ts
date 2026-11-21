import { NextResponse } from "next/server";

import { runAssessment } from "@/lib/assess/run";
import { requireUser } from "@/lib/auth/session";
import { plural } from "@/lib/rm/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/assessments/<id>/run — przeliczenie oceny na bazie porównawczej (deterministycznie albo modelem AI — wg trybu oceny). */
export async function POST(_: Request, { params }: RouteContext<"/api/assessments/[id]/run">) {
  await requireUser();
  const { id } = await params;
  try {
    const result = await runAssessment(id);
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Dobrano ${plural(result.considered, ["przypadek", "przypadki", "przypadków"])}, w statystyce ${result.included}; ${plural(result.items, ["pozycja", "pozycje", "pozycji"])} (ryzyka, zalecenia, flagi).`,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
