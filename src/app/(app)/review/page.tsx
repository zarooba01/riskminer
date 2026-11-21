import type { Metadata } from "next";

import { ReviewView } from "@/components/screens/review-view";
import { requireUser } from "@/lib/auth/session";
import { assignProcurementAction, decideCatalog, editCatalogGuidance, decideProcurement, decideRiskEvent, editRiskEvent, toggleExemplary } from "@/lib/rm/actions";
import { databaseConfigured, getReviewQueue } from "@/lib/rm/queries";

export const metadata: Metadata = { title: "Weryfikacja" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  await requireUser();
  const data = databaseConfigured ? await getReviewQueue() : { events: [], procurements: [], catalog: [], decisions: [], sources: {} };
  return (
    <ReviewView
      data={data}
      eventActions={{ decide: decideRiskEvent, edit: editRiskEvent, exemplary: toggleExemplary }}
      decideProcurement={decideProcurement}
      assignProcurement={assignProcurementAction}
      decideCatalog={decideCatalog}
      editGuidance={editCatalogGuidance}
    />
  );
}
