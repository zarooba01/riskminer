import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetailView } from "@/components/screens/project-detail-view";
import { requireUser } from "@/lib/auth/session";
import { llmConfig } from "@/lib/llm/config";
import { analyzeProjectAction, decideProcurement, decideRiskEvent, editRiskEvent, enrichProjectAction, toggleExemplary } from "@/lib/rm/actions";
import { databaseConfigured, getCatalog, getProject } from "@/lib/rm/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  await requireUser();
  const { id } = await params;
  if (!databaseConfigured) notFound();
  const [data, catalog] = await Promise.all([getProject(id), getCatalog()]);
  if (!data) notFound();

  return (
    <ProjectDetailView
      data={data}
      catalog={catalog.filter((c) => c.approved)}
      model={llmConfig.model}
      enrich={enrichProjectAction.bind(null, id)}
      analyze={analyzeProjectAction.bind(null, id)}
      eventActions={{ decide: decideRiskEvent, edit: editRiskEvent, exemplary: toggleExemplary }}
      decideProcurement={decideProcurement}
    />
  );
}
