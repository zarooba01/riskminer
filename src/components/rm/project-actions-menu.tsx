"use client";

import { BotIcon, DownloadIcon, EllipsisIcon, FilePlusIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";

import { AddDocumentDialog } from "./add-document-dialog";

type Props = {
  projectId: string;
  contracts?: { id: string; label: string }[];
  enrich?: () => Promise<ActionResult>;
  analyze?: () => Promise<ActionResult>;
  canAnalyze: boolean;
};

/** Akcje projektu schowane w menu „⋯”: odświeżenie z BZP, analiza AI, eksport. */
export function ProjectActionsMenu({ projectId, contracts = [], enrich, analyze, canAnalyze }: Props) {
  const [pending, start] = useTransition();
  const [docOpen, setDocOpen] = useState(false);
  const run = (fn: () => Promise<ActionResult>, startMessage: string) =>
    start(async () => {
      const id = toast.loading(startMessage);
      const result = await fn();
      if (result.ok) toast.success(result.message, { id });
      else toast.error(result.message, { id });
    });
  const q = `project=${encodeURIComponent(projectId)}`;

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Akcje projektu" disabled={pending}>
          {pending ? <Spinner /> : <EllipsisIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {analyze && (
          <DropdownMenuItem disabled={!canAnalyze} onSelect={() => run(analyze, "Model analizuje ryzyka…")}>
            <BotIcon /> Analizuj ryzyka (AI)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => setDocOpen(true)}>
          <FilePlusIcon /> Dodaj dokument
        </DropdownMenuItem>
        {enrich && (
          <DropdownMenuItem onSelect={() => run(enrich, "Pobieram dane z BZP…")}>
            <RefreshCwIcon /> Odśwież z BZP
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`/api/export/projects?format=json&${q}`}>
            <DownloadIcon /> Eksport projektu (JSON)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/export/events?format=csv&${q}`}>
            <DownloadIcon /> Eksport zdarzeń (CSV)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AddDocumentDialog projectId={projectId} contracts={contracts} open={docOpen} onOpenChange={setDocOpen} />
    </>
  );
}
