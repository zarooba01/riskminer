"use client";

import { CheckIcon, QuoteIcon, RotateCcwIcon, StarIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { days, pln, type ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, RiskEvent, Source } from "@/lib/rm/types";

import { Confidence, Provenance, StatusBadge } from "./provenance";
import { RiskEventEditDialog, type RiskEventPatch } from "./risk-event-edit-dialog";
import { MissingData } from "./missing-data";
import { SourceLink } from "./source-link";

export type { RiskEventPatch } from "./risk-event-edit-dialog";

export type RiskEventActions = {
  decide: (id: string, decision: "accept" | "reject" | "reopen", comment?: string) => Promise<ActionResult>;
  edit: (id: string, patch: RiskEventPatch, comment?: string) => Promise<ActionResult>;
  exemplary: (id: string, value: boolean) => Promise<ActionResult>;
};

type Props = {
  event: RiskEvent;
  source?: Source | null;
  catalog: CatalogEntry[];
  actions?: RiskEventActions;
  projectLabel?: string;
};

/** Czy przyczyna to ten sam tekst co cytat (reguły biorą oba z przyczyny zmiany w ogłoszeniu) — wtedy pokazujemy tylko cytat. */
const sameText = (a: string | null, b: string | null) => {
  const norm = (s: string | null) => (s ?? "").replace(/[\s"„”]+/g, " ").trim().toLowerCase();
  return Boolean(a && b) && (norm(a) === norm(b) || norm(b).startsWith(norm(a)) || norm(a).startsWith(norm(b)));
};

/** `required` — gdy źródło nie podaje wartości, pokazujemy „brak danych w źródle” zamiast ukrywać pole. */
function Row({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  if (!children && !required) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || <MissingData />}</dd>
    </div>
  );
}

const orNull = (v: string | null) => (!v || /^\s*brak danych\b/i.test(v) ? null : v);

export function RiskEventCard({ event, source, catalog, actions, projectLabel }: Props) {
  const [pending, start] = useTransition();
  const catalogName = catalog.find((c) => c.code === event.risk_code)?.name;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {event.risk_code}
          </Badge>
          <Provenance kind={event.origin} />
          <StatusBadge status={event.status} />
          <Confidence value={event.confidence} />
          {event.exemplary && (
            <Badge variant="secondary" className="gap-1">
              <StarIcon className="size-3" aria-hidden /> wzorcowy
            </Badge>
          )}
        </div>
        <CardTitle className="text-base leading-snug">{event.title}</CardTitle>
        <CardDescription>
          {projectLabel ? `${projectLabel} · ` : ""}
          {catalogName ?? "kategoria spoza katalogu — do decyzji eksperta"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2">
          <Row label="Sygnał">{event.signal}</Row>
          <Row label="Zdarzenie">{event.event}</Row>
          <Row label="Przyczyna" required>
            {sameText(event.cause, event.quote) ? <span className="text-muted-foreground">podana w źródle — cytat poniżej</span> : orNull(event.cause)}
          </Row>
          <Row label="Wpływ" required>
            {orNull(event.impact)}
          </Row>
          <Row label="Działanie zaradcze">{event.mitigation}</Row>
          <Row label="Skutek (czas, koszt)" required>
            {event.delay_days != null || event.cost_pln != null ? (
              <span className="tabular-nums">
                czas: {event.delay_days != null ? days(event.delay_days) : "brak danych"} · koszt: {event.cost_pln != null ? pln(event.cost_pln) : "brak danych"}
              </span>
            ) : null}
          </Row>
        </dl>
        {event.quote && (
          <figure className="rounded-lg border bg-muted/40 p-3">
            <blockquote className="flex gap-2 text-sm italic">
              <QuoteIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="break-words">{event.quote}</span>
            </blockquote>
            <figcaption className="mt-2 flex flex-wrap items-center gap-2">
              <SourceLink source={source} quote={event.quote} projectId={event.project_id} />
              {event.quote_verified === true && <Badge variant="outline">cytat zweryfikowany w źródle</Badge>}
              {event.quote_verified === false && <Badge variant="destructive">cytatu nie znaleziono w źródle</Badge>}
            </figcaption>
          </figure>
        )}
      </CardContent>
      {actions && (
        <CardFooter className="flex flex-wrap gap-2">
          {event.status !== "accepted" && (
            <Button size="sm" disabled={pending} onClick={() => run(() => actions.decide(event.id, "accept"))}>
              <CheckIcon /> Zatwierdź
            </Button>
          )}
          <RiskEventEditDialog event={event} catalog={catalog} onSave={actions.edit} disabled={pending} />
          {event.status !== "rejected" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.decide(event.id, "reject"))}>
              <XIcon /> Odrzuć
            </Button>
          )}
          {event.status !== "proposed" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.decide(event.id, "reopen"))}>
              <RotateCcwIcon /> Przywróć
            </Button>
          )}
          {event.status === "accepted" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.exemplary(event.id, !event.exemplary))}>
              <StarIcon /> {event.exemplary ? "Usuń wzorzec" : "Oznacz jako wzorcowy"}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
