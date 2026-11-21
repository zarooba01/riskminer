import type { Metadata } from "next";

import { AssessmentsView } from "@/components/screens/assessments-view";
import { listAssessments } from "@/lib/assess/queries";
import { requireUser } from "@/lib/auth/session";
import { deleteAssessment } from "@/lib/rm/actions";
import { databaseConfigured } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Zapisane oceny" };
export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  await requireUser();
  const assessments = databaseConfigured ? await listAssessments() : [];
  return <AssessmentsView assessments={assessments} remove={deleteAssessment} />;
}
