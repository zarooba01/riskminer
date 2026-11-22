import type { Metadata } from "next";

import { ProjectsListView } from "@/components/screens/projects-list-view";
import { requireUser } from "@/lib/auth/session";
import { addProject, addProjects, assignProcurementAction, clearProjectData, decideProcurement, enrichProjectAction } from "@/lib/rm/actions";
import { databaseConfigured, listProjects } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Zrealizowane inwestycje" };
export const dynamic = "force-dynamic";

/** Kolejny identyfikator w schemacie organizatora RM-RRRR-NNN. */
function nextProjectId(ids: string[]): string {
  const year = new Date().getFullYear();
  const max = ids.reduce((acc, id) => {
    const m = id.match(new RegExp(`^RM-${year}-(\\d+)$`));
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `RM-${year}-${String(max + 1).padStart(3, "0")}`;
}

export default async function ProjectsPage() {
  await requireUser();
  const projects = databaseConfigured ? await listProjects() : [];
  return (
    <ProjectsListView
      projects={projects}
      addProject={addProject}
      suggestedId={nextProjectId(projects.map((p) => p.id))}
      addAction={addProjects}
      matchActions={{ decide: decideProcurement, assign: assignProcurementAction }}
      clearAction={clearProjectData}
      enrichAction={enrichProjectAction}
    />
  );
}
