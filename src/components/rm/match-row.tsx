"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ActionResult } from "@/lib/rm/format";
import type { Procurement } from "@/lib/rm/types";

import { MatchDialog, type MatchActions, type MatchDialogProject } from "./match-dialog";
import { cn } from "@/lib/utils";

type Props = {
  match: Procurement & { project_title: string; project?: MatchDialogProject; notice_url?: string | null; published_at?: string | null };
  decide?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  assign?: MatchActions["assign"];
};

/** Zwarty wiersz dopasowania projekt ↔ przetarg BZP: pewność, oba tytuły, szybkie ✓/✗; podstawa po rozwinięciu. */
export function MatchRow({ match, decide, assign }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const confidence = Math.round(match.match_confidence * 100);

  const run = (decision: "accept" | "reject") =>
    start(async () => {
      const result = await decide!(match.id, decision);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  return (
    <li className="border-b last:border-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 py-2.5">
          <span
            className={cn(
              "w-12 shrink-0 text-right text-sm font-semibold tabular-nums",
              confidence >= 85 ? "text-success" : confidence >= 65 ? "text-foreground" : "text-destructive",
            )}
            title="Pewność dopasowania"
          >
            {confidence}%
          </span>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:bg-muted/40" aria-label={`${match.project_id} — pokaż podstawę dopasowania`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-1 text-sm break-all sm:break-normal">
                  <span className="font-mono text-xs text-muted-foreground">{match.project_id}</span> {match.project_title}
                </span>
                <span className="line-clamp-1 text-sm text-muted-foreground break-all sm:break-normal">
                  → {match.bzp_number}: {match.title}
                </span>
              </span>
              <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          </CollapsibleTrigger>
          {decide && (
            <span className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" className="size-8 text-success" disabled={pending} onClick={() => run("accept")} aria-label="Potwierdź dopasowanie">
                <CheckIcon />
              </Button>
              <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} onClick={() => run("reject")} aria-label="Odrzuć dopasowanie">
                <XIcon />
              </Button>
            </span>
          )}
        </div>
        <CollapsibleContent>
          <div className="mb-3 ml-15 flex flex-col gap-2 rounded-lg bg-muted/30 p-3 text-sm">
            <ul className="flex flex-col gap-0.5">
              {match.match_basis.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
            <span className="flex flex-wrap items-center gap-3">
              {decide && assign && (
                <MatchDialog
                  project={match.project ?? { id: match.project_id, title: match.project_title, beneficiary_name: "", beneficiary_nip: null, public_id_type: null, public_id: null }}
                  match={{
                    id: match.id,
                    status: match.status === "accepted" ? "accepted" : "proposed",
                    bzp_number: match.bzp_number,
                    title: match.title,
                    buyer_name: match.buyer_name,
                    buyer_nip: match.buyer_nip,
                    cpv: match.cpv,
                    confidence: match.match_confidence,
                    method: match.match_method,
                    basis: match.match_basis,
                    notice_url: match.notice_url ?? null,
                    published_at: match.published_at ?? null,
                  }}
                  actions={{ decide, assign }}
                >
                  <Button size="sm" variant="outline">
                    Porównaj / wskaż inny
                  </Button>
                </MatchDialog>
              )}
              <Link href={`/projects/${encodeURIComponent(match.project_id)}`} className="text-xs text-primary hover:underline">
                Otwórz inwestycję
              </Link>
            </span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
