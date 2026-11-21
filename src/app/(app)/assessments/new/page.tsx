import type { Metadata } from "next";

import { NewAssessmentView } from "@/components/screens/new-assessment-view";
import { requireUser } from "@/lib/auth/session";
import { llmConfig, regionOf } from "@/lib/llm/config";

export const metadata: Metadata = { title: "Nowa inwestycja" };
export const dynamic = "force-dynamic";

export default async function NewAssessmentPage() {
  await requireUser();
  return <NewAssessmentView model={llmConfig.model} region={regionOf(llmConfig.model)} />;
}
