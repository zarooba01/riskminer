import type { Metadata } from "next";

import { ReviewView } from "@/components/screens/review-view";
import { requireUser } from "@/lib/auth/session";
import { assignProcurementAction, decideCatalog, editCatalogGuidance, decideProcurement, decideRiskEvent, editRiskEvent, toggleExemplary } from "@/lib/rm/actions";
import { databaseConfigured, getReviewQueue } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Weryfikacja" };
export const dynamic = "force-dynamic";

const tabs = ["events", "matches", "catalog", "history"] as const;
type ReviewTab = (typeof tabs)[number];

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  await requireUser();
  const { tab } = await searchParams;
  const initialTab = tabs.includes(tab as ReviewTab) ? (tab as ReviewTab) : undefined;
  const data = databaseConfigured ? await getReviewQueue() : { events: [], procurements: [], catalog: [], decisions: [], sources: {} };
  return (
    <ReviewView
      data={data}
      initialTab={initialTab}
      eventActions={{ decide: decideRiskEvent, edit: editRiskEvent, exemplary: toggleExemplary }}
      decideProcurement={decideProcurement}
      assignProcurement={assignProcurementAction}
      decideCatalog={decideCatalog}
      editGuidance={editCatalogGuidance}
    />
  );
}
