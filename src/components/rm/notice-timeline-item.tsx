"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { NoticeSummary } from "@/lib/rm/notice-summary";
import type { Source } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

import { SourceLink } from "./source-link";

type Props = {
  date: string;
  label: string;
  noticeNumber: string;
  source?: Source;
  summary: NoticeSummary;
  /** Projekt, do którego wraca podgląd źródła. */
  projectId?: string;
  /** Pozycje podrzędne zawsze widoczne pod ogłoszeniem, np. zmiany umowy z ogłoszenia o wykonaniu. */
  subItems?: { key: string; label: string; detail: string; effect?: string | null; warning?: boolean; href?: string | null }[];
};

/** Pozycja osi czasu: po lewej ogłoszenie, po prawej krótkie podsumowanie, pod spodem rozwijane szczegóły. */
export function NoticeTimelineItem({ date, label, noticeNumber, source, summary, subItems, projectId }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetails = summary.blocks.some((b) => b.rows.length);

  return (
    <li className="relative">
      <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background", summary.tone === "warning" ? "bg-destructive" : "bg-primary")} aria-hidden />
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild disabled={!hasDetails}>
          <button
            type="button"
            className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md py-1 text-left hover:bg-muted/40 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]"
            aria-label={`${label}, ${date}${hasDetails ? " — pokaż szczegóły" : ""}`}
          >
            <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">{date}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">
                <span className="text-muted-foreground tabular-nums sm:hidden">{date} · </span>
                {label}
              </span>
              {summary.summary && <span className="line-clamp-2 text-sm text-muted-foreground">{summary.summary}</span>}
            </span>
            {hasDetails && <ChevronDownIcon className={cn("mt-0.5 size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 mb-1 flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <SourceLink source={source} label={noticeNumber} projectId={projectId} />
            {summary.blocks
              .filter((b) => b.rows.length)
              .map((block) => (
                <section key={block.title} className="flex flex-col gap-1.5">
                  <h4 className="text-sm font-semibold">{block.title}</h4>
                  <dl className="flex flex-col gap-1.5">
                    {block.rows.map((row) => (
                      <div key={row.label} className="grid gap-0.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-3">
                        <dt className="text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="text-sm break-words whitespace-pre-line">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {!!subItems?.length && (
        <ol className="mt-1 mb-1 ml-2 flex flex-col gap-1 border-l border-dashed pl-4 sm:ml-[7.5rem]" aria-label="Zmiany umowy">
          {subItems.map((item) => (
            <li key={item.key} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
              <span className={cn("absolute top-2 -left-[19.5px] size-1.5 rounded-full", item.warning ? "bg-destructive" : "bg-muted-foreground/60")} aria-hidden />
              <span className="min-w-0">
                {item.href ? (
                  <Link href={item.href} className="font-medium underline-offset-4 hover:text-primary hover:underline" title="Pokaż fragment w źródle">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium">{item.label}</span>
                )}{" "}
                <span className="text-muted-foreground">· {item.detail}</span>
              </span>
              {item.effect && <span className="text-muted-foreground tabular-nums">{item.effect}</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
