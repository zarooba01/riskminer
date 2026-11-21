import type { Metadata } from "next";

import { ExportView } from "@/components/screens/export-view";
import { requireUser } from "@/lib/auth/session";
import { exportEntities } from "@/lib/rm/export";
import { databaseConfigured } from "@/lib/rm/queries";
import { db } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Eksport" };
export const dynamic = "force-dynamic";

export default async function ExportPage() {
  await requireUser();
  const entries = Object.entries(exportEntities);
  const counts = databaseConfigured
    ? await Promise.all(entries.map(async ([, spec]) => (await db().from(spec.table).select("*", { count: "exact", head: true })).count ?? 0))
    : entries.map(() => null);
  return <ExportView entities={entries.map(([key, spec], i) => ({ key, label: spec.label, count: counts[i] }))} />;
}
