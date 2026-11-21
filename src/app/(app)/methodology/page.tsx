import type { Metadata } from "next";

import { MethodologyView } from "@/components/screens/methodology-view";
import { requireUser } from "@/lib/auth/session";
import { databaseConfigured } from "@/lib/rm/queries";
import { db } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Obliczenia" };
export const dynamic = "force-dynamic";

export default async function MethodologyPage() {
  await requireUser();
  const corpus = databaseConfigured
    ? ((await db().from("rm_ref_cases").select("project_id", { count: "exact", head: true })).count ?? undefined)
    : undefined;
  return <MethodologyView corpus={corpus} />;
}
