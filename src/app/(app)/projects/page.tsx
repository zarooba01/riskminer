import type { Metadata } from "next";

import { ProjectsListView } from "@/components/screens/projects-list-view";
import { requireUser } from "@/lib/auth/session";
import { databaseConfigured, listProjects } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Projekty" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireUser();
  return <ProjectsListView projects={databaseConfigured ? await listProjects() : []} />;
}
