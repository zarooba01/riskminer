"use client";

import { EllipsisIcon, FileJsonIcon, FileSpreadsheetIcon, RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";

type Props = {
  assessmentId: string;
  rerun?: () => Promise<ActionResult>;
};

/** Akcje oceny schowane w menu „⋯”: aktualizacja na bieżącej bazie porównawczej (w trybie oceny), eksport JSON/CSV. */
export function AssessmentActionsMenu({ assessmentId, rerun }: Props) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, startMessage: string) =>
    start(async () => {
      const id = toast.loading(startMessage);
      const result = await fn();
      if (result.ok) toast.success(result.message, { id });
      else toast.error(result.message, { id });
    });
  const base = `/api/assessments/${assessmentId}/export`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Akcje oceny" disabled={pending}>
          {pending ? <Spinner /> : <EllipsisIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        {rerun && (
          <DropdownMenuItem onSelect={() => run(rerun, "Przeliczam ocenę na bieżącej bazie…")}>
            <RefreshCwIcon /> Zaktualizuj ocenę
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Eksport</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={`${base}?format=json`}>
            <FileJsonIcon /> Cała ocena (JSON)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}?format=csv&part=items`}>
            <FileSpreadsheetIcon /> Ryzyka i zalecenia (CSV)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}?format=csv&part=matches`}>
            <FileSpreadsheetIcon /> Podobne inwestycje (CSV)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
