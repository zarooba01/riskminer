import type { Metadata } from "next";

import { DashboardView } from "@/components/screens/dashboard-view";
import { requireUser } from "@/lib/auth/session";
import { llmConfig } from "@/lib/llm/config";
import { databaseConfigured, getDashboardStats, getQueueFlow } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Pulpit" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  if (!databaseConfigured) {
    return (
      <DashboardView
        stats={null}
        flow={null}
        model={llmConfig.model}
        configError="Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SECRET_KEY oraz uruchom migrację supabase/migrations/0002_riskminer.sql."
      />
    );
  }
  const [stats, flow] = await Promise.all([getDashboardStats(), getQueueFlow(31)]);
  return <DashboardView stats={stats} flow={flow} model={llmConfig.model} />;
}
