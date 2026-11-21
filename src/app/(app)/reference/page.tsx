import type { Metadata } from "next";

import { ReferenceBaseView } from "@/components/screens/reference-base-view";
import { getReferenceBase } from "@/lib/assess/queries";
import { requireUser } from "@/lib/auth/session";
import { rebuildReferenceBase } from "@/lib/rm/actions";
import { databaseConfigured } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Baza porównawcza" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ReferencePage() {
  await requireUser();
  const data = databaseConfigured ? await getReferenceBase() : { cases: [], lastBuild: null };
  return <ReferenceBaseView data={data} rebuild={rebuildReferenceBase} />;
}
