"use client";

import { CheckIcon, ChevronDownIcon, QuoteIcon, RotateCcwIcon, SparklesIcon, StarIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { days, pln, type ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, RiskEvent, Source } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

import { RiskEventEditDialog, type RiskEventPatch } from "./risk-event-edit-dialog";
import { MissingData } from "./missing-data";
import { SourceLink } from "./source-link";

export type RiskEventActions = {
  decide: (id: string, decision: "accept" | "reject" | "reopen", comment?: string) => Promise<ActionResult>;
  edit: (id: string, patch: RiskEventPatch, comment?: string) => Promise<ActionResult>;
  exemplary: (id: string, value: boolean) => Promise<ActionResult>;
};

const statusDot: Record<RiskEvent["status"], { className: string; label: string }> = {
  proposed: { className: "bg-warning", label: "do weryfikacji" },
  accepted: { className: "bg-success", label: "zatwierdzone" },
  rejected: { className: "bg-muted-foreground/40", label: "odrzucone" },
};

const originLabel: Record<RiskEvent["origin"], string> = { rule: "reguła", llm: "model AI", expert: "ekspert" };

/** Czy przyczyna to ten sam tekst co cytat (reguły biorą oba z przyczyny zmiany w ogłoszeniu) — wtedy pokazujemy tylko cytat. */
const sameText = (a: string | null, b: string | null) => {
  const norm = (s: string | null) => (s ?? "").replace(/[\s"„”]+/g, " ").trim().toLowerCase();
  return Boolean(a && b) && (norm(a) === norm(b) || norm(b).startsWith(norm(a)) || norm(a).startsWith(norm(b)));
};

/** Pole szczegółów; `required` — gdy źródło nie podaje wartości, pokazujemy „brak danych w źródle” zamiast ukrywać pole. */
function Detail({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  if (!children && !required) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || <MissingData />}</dd>
    </div>
  );
}

/** Model AI zapisuje „brak danych”, gdy źródło nie podaje przyczyny — traktujemy to jak brak wartości. */
const noData = (v: string | null) => !v || /^\s*brak danych\b/i.test(v);
const causeText = (v: string | null) => (noData(v) ? null : v);
const impactText = (v: string | null) => (noData(v) ? null : v);

/** Zwarty wiersz zdarzenia ryzyka: kod, tytuł, skutek, status, szybkie ✓/✗; szczegóły i cytat po rozwinięciu. */
export function RiskEventRow({ event, source, catalog, actions }: { event: RiskEvent; source?: Source | null; catalog: CatalogEntry[]; actions?: RiskEventActions }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dot = statusDot[event.status];
  const riskName = catalog.find((c) => c.code === event.risk_code)?.name;
  const effect = [event.delay_days != null && event.delay_days !== 0 ? days(event.delay_days) : null, event.cost_pln ? pln(event.cost_pln) : null].filter(Boolean).join(" · ");
  // W szczegółach oba wymiary skutku jawnie — brak wartości w źródle to „brak danych”, a nie puste pole.
  const effectDetail = effect ? `czas: ${event.delay_days != null ? days(event.delay_days) : "brak danych"} · koszt: ${event.cost_pln != null ? pln(event.cost_pln) : "brak danych"}` : null;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  return (
    <li className={cn("border-b last:border-0", event.status === "rejected" && "opacity-60")}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 py-2">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-muted/40" aria-label={`${event.risk_code} ${event.title} — ${dot.label}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("size-2 shrink-0 rounded-full", dot.className)} aria-hidden />
                </TooltipTrigger>
                <TooltipContent>{dot.label}</TooltipContent>
              </Tooltip>
              <Badge variant="outline" className="w-12 shrink-0 justify-center font-mono">
                {event.risk_code}
              </Badge>
              <span className="hidden w-72 shrink-0 line-clamp-2 text-sm leading-snug text-muted-foreground md:block" title={riskName ?? "Kategoria spoza katalogu"}>
                {riskName ?? "spoza katalogu"}
              </span>
              {event.origin === "llm" && (
                <Badge className="shrink-0 gap-1">
                  <SparklesIcon className="size-3" aria-hidden /> AI
                </Badge>
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm">
                  {event.title}
                  {event.exemplary && <StarIcon className="ml-1 inline size-3 text-warning" aria-label="wzorcowy" />}
                </span>
              </span>
              {effect && <span className="hidden shrink-0 text-sm text-muted-foreground tabular-nums sm:inline">{effect}</span>}
              <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          </CollapsibleTrigger>
          {actions && event.status === "proposed" && (
            <span className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" className="size-8 text-success" disabled={pending} onClick={() => run(() => actions.decide(event.id, "accept"))} aria-label="Zatwierdź">
                <CheckIcon />
              </Button>
              <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} onClick={() => run(() => actions.decide(event.id, "reject"))} aria-label="Odrzuć">
                <XIcon />
              </Button>
            </span>
          )}
        </div>
        <CollapsibleContent>
          <div className="mb-3 ml-5 flex flex-col gap-3 rounded-lg bg-muted/30 p-3">
            <dl className="flex flex-col gap-1.5">
              <Detail label="Sygnał">{event.signal}</Detail>
              <Detail label="Przyczyna" required>
                {sameText(event.cause, event.quote) ? <span className="text-muted-foreground">podana w źródle — cytat poniżej</span> : causeText(event.cause)}
              </Detail>
              <Detail label="Wpływ" required>
                {impactText(event.impact)}
              </Detail>
              <Detail label="Działanie zaradcze">{event.mitigation}</Detail>
              <Detail label="Skutek (czas, koszt)" required>
                {effectDetail}
              </Detail>
            </dl>
            {event.quote && (
              <figure className="flex flex-col gap-1.5">
                <blockquote className="flex gap-2 text-sm italic">
                  <QuoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="break-words">{event.quote}</span>
                </blockquote>
                <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <SourceLink source={source} quote={event.quote} projectId={event.project_id} />
                  {event.page != null && <span>str. {event.page}</span>}
                  {event.quote_verified === false && <span className="text-destructive">cytatu nie znaleziono w źródle</span>}
                  <span>
                    {originLabel[event.origin]}
                    {event.confidence != null && ` · pewność ${Math.round(event.confidence * 100)}%`}
                  </span>
                </figcaption>
              </figure>
            )}
            {actions && (
              <div className="flex flex-wrap gap-2">
                <RiskEventEditDialog event={event} catalog={catalog} onSave={actions.edit} disabled={pending} />
                {event.status === "accepted" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.exemplary(event.id, !event.exemplary))}>
                    <StarIcon /> {event.exemplary ? "Usuń wzorzec" : "Wzorcowy"}
                  </Button>
                )}
                {event.status !== "proposed" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.decide(event.id, "reopen"))}>
                    <RotateCcwIcon /> Przywróć
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
