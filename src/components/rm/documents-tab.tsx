"use client";

import { FilePlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { ActionResult } from "@/lib/rm/format";
import type { DocumentFinding, ProjectDocument } from "@/lib/rm/types";

import { AddDocumentDialog } from "./add-document-dialog";
import { DocumentCard } from "./document-card";

type Props = {
  projectId: string;
  contracts: { id: string; label: string }[];
  documents: (ProjectDocument & { findings: DocumentFinding[] })[];
  decide?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
};

/** Zakładka „Dokumenty”: dokumenty dodane przez eksperta i ich ustalenia względem danych sprawy. */
export function DocumentsTab({ projectId, contracts, documents, decide }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Aneksy, SWZ, protokoły — system porówna je z danymi z BZP i zaproponuje ustalenia.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <FilePlusIcon /> Dodaj dokument
        </Button>
      </div>
      {documents.length ? (
        documents.map((d) => <DocumentCard key={d.id} document={d} projectId={projectId} decide={decide} />)
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Brak dokumentów</EmptyTitle>
            <EmptyDescription>Dodaj PDF lub DOCX dotyczący tej inwestycji.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <AddDocumentDialog projectId={projectId} contracts={contracts} open={open} onOpenChange={setOpen} />
    </div>
  );
}
