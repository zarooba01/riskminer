"use client";

import { CheckIcon, PencilIcon, QuoteIcon, RotateCcwIcon, StarIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { days, pln, type ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, RiskEvent, Source } from "@/lib/rm/types";

import { Confidence, Provenance, StatusBadge } from "./provenance";
import { SourceLink } from "./source-link";

export type RiskEventPatch = {
  risk_code: string;
  title: string;
  cause: string;
  impact: string;
  mitigation: string;
  delay_days: number | null;
  cost_pln: number | null;
};

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function RiskEventCard({ event, source, catalog, actions, projectLabel }: Props) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const catalogName = catalog.find((c) => c.code === event.risk_code)?.name;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });

  const onEdit = (form: FormData) => {
    const num = (key: string) => {
      const v = String(form.get(key) ?? "").replace(",", ".").trim();
      return v === "" ? null : Number(v);
    };
    const patch: RiskEventPatch = {
      risk_code: String(form.get("risk_code")),
      title: String(form.get("title")),
      cause: String(form.get("cause")),
      impact: String(form.get("impact")),
      mitigation: String(form.get("mitigation")),
      delay_days: num("delay_days"),
      cost_pln: num("cost_pln"),
    };
    run(async () => {
      const result = await actions!.edit(event.id, patch, String(form.get("comment") ?? ""));
      if (result.ok) setOpen(false);
      return result;
    });
  };

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
          <Row label="Przyczyna">{event.cause}</Row>
          <Row label="Wpływ">{event.impact}</Row>
          <Row label="Działanie zaradcze">{event.mitigation}</Row>
          <Row label="Skutek">
            {event.delay_days != null || event.cost_pln != null ? (
              <span className="tabular-nums">
                czas: {days(event.delay_days)} · koszt: {pln(event.cost_pln)}
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
              <SourceLink source={source} />
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                <PencilIcon /> Popraw
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Popraw zdarzenie</DialogTitle>
                <DialogDescription>Poprawione zdarzenie zostanie zatwierdzone. Zmiana trafi do historii decyzji.</DialogDescription>
              </DialogHeader>
              <form action={onEdit} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`code-${event.id}`}>Kategoria</FieldLabel>
                    <Select name="risk_code" defaultValue={event.risk_code}>
                      <SelectTrigger id={`code-${event.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} {c.name}
                          </SelectItem>
                        ))}
                        {!catalog.some((c) => c.code === event.risk_code) && <SelectItem value={event.risk_code}>{event.risk_code}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`title-${event.id}`}>Tytuł</FieldLabel>
                    <Input id={`title-${event.id}`} name="title" defaultValue={event.title} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`cause-${event.id}`}>Przyczyna</FieldLabel>
                    <Textarea id={`cause-${event.id}`} name="cause" defaultValue={event.cause ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`impact-${event.id}`}>Wpływ</FieldLabel>
                    <Textarea id={`impact-${event.id}`} name="impact" defaultValue={event.impact ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`mit-${event.id}`}>Działanie zaradcze / zapis umowny</FieldLabel>
                    <Textarea id={`mit-${event.id}`} name="mitigation" defaultValue={event.mitigation ?? ""} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor={`days-${event.id}`}>Opóźnienie (dni)</FieldLabel>
                      <Input id={`days-${event.id}`} name="delay_days" inputMode="numeric" defaultValue={event.delay_days ?? ""} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`cost-${event.id}`}>Koszt (zł)</FieldLabel>
                      <Input id={`cost-${event.id}`} name="cost_pln" inputMode="decimal" defaultValue={event.cost_pln ?? ""} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`comment-${event.id}`}>Komentarz eksperta</FieldLabel>
                    <Input id={`comment-${event.id}`} name="comment" placeholder="np. przyczyna potwierdzona w protokole" />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    Zapisz i zatwierdź
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
