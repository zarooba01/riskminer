import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssessmentDetailView } from "@/components/screens/assessment-detail-view";
import { getAssessment } from "@/lib/assess/queries";
import { requireUser } from "@/lib/auth/session";
import { llmConfig, regionOf } from "@/lib/llm/config";
import { decideAssessmentItem, rerunAssessment, updateAssessmentParams } from "@/lib/rm/actions";
import { databaseConfigured } from "@/lib/rm/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function generateMetadata({ params }: PageProps<"/assessments/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = databaseConfigured ? await getAssessment(id) : null;
  return { title: data?.assessment.title ?? "Ocena inwestycji" };
}

export default async function AssessmentPage({ params }: PageProps<"/assessments/[id]">) {
  await requireUser();
  const { id } = await params;
  if (!databaseConfigured) notFound();
  const data = await getAssessment(id);
  if (!data) notFound();
  return (
    <AssessmentDetailView
      data={data}
      model={llmConfig.model}
      region={regionOf(llmConfig.model)}
      rerun={rerunAssessment.bind(null, id)}
      saveParams={updateAssessmentParams.bind(null, id)}
      decide={decideAssessmentItem}
    />
  );
}
