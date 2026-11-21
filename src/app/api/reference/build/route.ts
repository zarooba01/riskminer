import { NextResponse } from "next/server";

import { buildReferenceBase } from "@/lib/assess/reference";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/reference/build — (od)budowa bazy porównawczej z bieżących danych; oryginały zostają bez zmian. */
export async function POST() {
  await requireUser();
  try {
    const r = await buildReferenceBase();
    return NextResponse.json({ ok: true, ...r, message: `Baza porównawcza: ${r.cases} projektów, ${r.events} zaakceptowanych zdarzeń.` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
