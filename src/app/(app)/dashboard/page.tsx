import type { Metadata } from "next";

import { DashboardView } from "@/components/screens/dashboard-view";
import { requireUser } from "@/lib/auth/session";
import { llmConfig } from "@/lib/llm/config";
import { enrichProjectAction, importProjects } from "@/lib/rm/actions";
import { databaseConfigured, getDashboardStats, listProjects } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Pulpit" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  if (!databaseConfigured) {
    return (
      <DashboardView
        stats={null}
        model={llmConfig.model}
        configError="Ustaw NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SECRET_KEY oraz uruchom migrację supabase/migrations/0002_riskminer.sql."
        projectIds={[]}
        importAction={importProjects}
        enrichAction={enrichProjectAction}
      />
    );
  }
  const [stats, projects] = await Promise.all([getDashboardStats(), listProjects()]);
  return (
    <DashboardView
      stats={stats}
      model={llmConfig.model}
      projectIds={projects.map((p) => p.id)}
      importAction={importProjects}
      enrichAction={enrichProjectAction}
    />
  );
}
