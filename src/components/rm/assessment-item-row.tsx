"use client";

import { CheckIcon, ChevronDownIcon, QuoteIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { itemKindLabels, type AssessmentItem, type ItemBasis } from "@/lib/assess/types";
import type { ActionResult } from "@/lib/rm/format";
import type { Source } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

import { Provenance, type ProvenanceKind } from "./provenance";
import { SourceLink } from "./source-link";

export type ItemDecision = (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;

/** Pochodzenie pozycji oceny → oznaczenie: obliczenie, źródło, ekspert (katalog), dane użytkownika, model AI. */
export const basisProvenance: Record<ItemBasis, ProvenanceKind> = { calc: "calc", source: "source", expert: "expert", input: "input", llm: "llm" };

const statusDot: Record<AssessmentItem["status"], { className: string; label: string }> = {
  proposed: { className: "bg-warning", label: "do weryfikacji" },
  accepted: { className: "bg-success", label: "zatwierdzone przez eksperta" },
  rejected: { className: "bg-muted-foreground/40", label: "odrzucone" },
};

type Props = {
  item: AssessmentItem;
  sources: Record<string, Source>;
  projectTitles: Record<string, string>;
  decide?: ItemDecision;
  /** Pokazuj rodzaj pozycji (gdy lista miesza rodzaje). */
  showKind?: boolean;
};

/** Pozycja oceny: tytuł, pochodzenie, oparcie w przypadkach (n/N), cytaty ze źródeł i decyzja eksperta. */
export function AssessmentItemRow({ item, sources, projectTitles, decide, showKind }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dot = statusDot[item.status];
  const examples = item.support?.examples ?? [];
  const projects = item.support?.project_ids ?? [];
  const hasDetails = Boolean(item.body || examples.length || projects.length);

  const run = (decision: "accept" | "reject" | "reopen") =>
    decide &&
    start(async () => {
      const result = await decide(item.id, decision);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  return (
    <li className={cn("border-b last:border-0", item.status === "rejected" && "opacity-60")}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start gap-2 py-2">
          <CollapsibleTrigger asChild disabled={!hasDetails}>
            <button type="button" className="flex min-w-0 flex-1 items-start gap-3 rounded-md py-0.5 text-left hover:bg-muted/40" aria-label={decide ? `${item.title} — ${dot.label}` : item.title}>
              {/* Status decyzji tylko tam, gdzie ekspert decyduje (wnioski AI); flagi i obliczenia go nie mają. */}
              {decide && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot.className)} aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent>{dot.label}</TooltipContent>
                </Tooltip>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm leading-snug">{item.title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Provenance kind={basisProvenance[item.basis]} />
                  {showKind && <Badge variant="secondary">{itemKindLabels[item.kind]}</Badge>}
                  {item.risk_code && (
                    <Badge variant="outline" className="font-mono">
                      {item.risk_code}
                    </Badge>
                  )}
                  {item.n_total != null && item.n_cases != null && (
                    <Badge variant="outline" className="tabular-nums">
                      {item.n_cases} z {item.n_total} przypadków
                    </Badge>
                  )}
                  {item.n_total != null && item.n_cases == null && <span className="text-xs text-muted-foreground">próba: {item.n_total}</span>}
                </span>
              </span>
              {hasDetails && <ChevronDownIcon className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
            </button>
          </CollapsibleTrigger>
          {decide && (
            <span className="flex shrink-0 gap-1">
              {item.status === "proposed" ? (
                <>
                  <Button size="icon" variant="ghost" className="size-8 text-success" disabled={pending} onClick={() => run("accept")} aria-label="Zatwierdź">
                    <CheckIcon />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} onClick={() => run("reject")} aria-label="Odrzuć">
                    <XIcon />
                  </Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" className="size-8" disabled={pending} onClick={() => run("reopen")} aria-label="Przywróć do weryfikacji">
                  <RotateCcwIcon />
                </Button>
              )}
            </span>
          )}
        </div>
        <CollapsibleContent>
          <div className="mb-3 ml-5 flex flex-col gap-3 rounded-lg bg-muted/30 p-3">
            {item.body && <p className="text-sm">{item.body}</p>}
            {examples.map((ex, i) => (
              <figure key={`${ex.source_id}-${i}`} className="flex flex-col gap-1">
                {ex.label && <figcaption className="text-xs font-medium">{ex.project_id === "plan" ? ex.label : `${ex.project_id}: ${ex.label}`}</figcaption>}
                {ex.quote && (
                  <blockquote className="flex gap-2 text-sm italic">
                    <QuoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="break-words">{ex.quote}</span>
                  </blockquote>
                )}
                <SourceLink source={ex.source_id ? sources[ex.source_id] : null} quote={ex.quote} projectId={ex.project_id === "plan" ? null : ex.project_id} />
              </figure>
            ))}
            {projects.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Przypadki:</span>
                {projects.map((pid) => (
                  <Link key={pid} href={`/projects/${encodeURIComponent(pid)}`} className="text-primary underline-offset-4 hover:underline" title={projectTitles[pid]}>
                    {pid}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
