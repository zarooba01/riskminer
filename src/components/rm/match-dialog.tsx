"use client";

import { CheckIcon, ExternalLinkIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";
import type { MatchInfo } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

export type MatchDialogProject = {
  id: string;
  title: string;
  beneficiary_name: string;
  beneficiary_nip: string | null;
  public_id_type: string | null;
  public_id: string | null;
};

export type MatchActions = {
  decide: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  /** `add` — dodaj jako kolejne zamówienie projektu, zamiast zastępować obecne dopasowanie. */
  assign: (projectId: string, noticeNumber: string, add?: boolean) => Promise<ActionResult>;
};

type Props = {
  project: MatchDialogProject;
  match: MatchInfo | null;
  actions: MatchActions;
  children: React.ReactNode;
};

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function Side({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <dl className="flex flex-col gap-1.5">
        {rows
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm break-words">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

/**
 * Okno sprawdzenia powiązania projekt ↔ przetarg BZP: porównanie obok siebie, pewność i podstawa,
 * Potwierdź / Odrzuć oraz ręczne wskazanie innego przetargu (numer ogłoszenia o zamówieniu).
 */
export function MatchDialog({ project, match, actions, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [assigning, setAssigning] = useState(!match);
  const [number, setNumber] = useState("");
  const [add, setAdd] = useState(false);

  const nipOk = match && digits(match.buyer_nip) && digits(match.buyer_nip) === digits(project.beneficiary_nip);
  const confidence = match ? Math.round(match.confidence * 100) : null;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else toast.error(result.message);
    });

  const description = !match
    ? "Nie ma powiązanego przetargu. Wskaż numer ogłoszenia o zamówieniu w BZP."
    : match.status === "proposed"
      ? "System znalazł ten przetarg wyszukiwaniem. Sprawdź, czy to na pewno ten projekt."
      : "Powiązanie zatwierdzone. Jeśli jest błędne, wskaż inny przetarg.";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setAssigning(!match);
          setNumber("");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Powiązanie z przetargiem — {project.id}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <Side
            title="Projekt z pliku"
            rows={[
              ["Nazwa", project.title],
              ["Zamawiający", project.beneficiary_name],
              ["NIP", project.beneficiary_nip],
              [project.public_id_type ?? "Identyfikator", project.public_id],
            ]}
          />
          {match ? (
            <Side
              title="Przetarg w BZP"
              rows={[
                ["Nazwa", match.title],
                ["Zamawiający", match.buyer_name],
                [
                  "NIP",
                  match.buyer_nip ? (
                    <span className={cn(nipOk ? "text-success" : "text-destructive")}>
                      {match.buyer_nip} {nipOk ? "✓ zgodny" : "✗ inny niż w projekcie"}
                    </span>
                  ) : null,
                ],
                [
                  "Ogłoszenie",
                  match.notice_url ? (
                    <a href={match.notice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {match.bzp_number} <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : (
                    match.bzp_number
                  ),
                ],
                ["Data ogłoszenia", match.published_at?.slice(0, 10) ?? null],
                ["CPV", match.cpv?.split(" (")[0] ?? null],
              ]}
            />
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Brak powiązanego przetargu</div>
          )}
        </div>

        {match && (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              <span className="text-muted-foreground">Pewność: </span>
              <span className={cn("font-semibold", (confidence ?? 0) >= 85 ? "text-success" : (confidence ?? 0) < 65 ? "text-destructive" : "")}>{confidence}%</span>
              <span className="text-muted-foreground"> · {match.method === "notice_number" ? "po numerze ogłoszenia" : match.method === "manual" ? "wskazane ręcznie" : "wyszukiwanie po NIP i nazwie"}</span>
            </p>
            <ul className="text-muted-foreground">
              {match.basis.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          </div>
        )}

        {assigning && (
          <form
            className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => actions.assign(project.id, number, add));
            }}
          >
            <Field>
              <FieldLabel htmlFor={`assign-${project.id}`}>Numer ogłoszenia o zamówieniu w BZP</FieldLabel>
              <div className="flex gap-2">
                <Input id={`assign-${project.id}`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="np. 2022/BZP 00058537/01" autoFocus disabled={pending} />
                <Button type="submit" disabled={pending || !number.trim()}>
                  {pending ? <Spinner /> : <SearchIcon />} Przypisz
                </Button>
              </div>
              <FieldDescription>System pobierze ogłoszenia tego przetargu i przeliczy umowę, koszt, czas i zdarzenia.</FieldDescription>
            </Field>
            {match?.status === "accepted" && (
              <Field orientation="horizontal">
                <Checkbox id={`assign-add-${project.id}`} checked={add} onCheckedChange={(v) => setAdd(v === true)} disabled={pending} />
                <FieldLabel htmlFor={`assign-add-${project.id}`} className="font-normal">
                  Dodaj jako kolejne zamówienie inwestycji (obecne zostaje)
                </FieldLabel>
              </Field>
            )}
          </form>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {!assigning ? (
            <Button variant="ghost" onClick={() => setAssigning(true)} disabled={pending}>
              <SearchIcon /> Wskaż inny przetarg
            </Button>
          ) : (
            <span />
          )}
          {match?.status === "proposed" && (
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => run(() => actions.decide(match.id, "reject"))} disabled={pending}>
                <XIcon /> Odrzuć
              </Button>
              <Button onClick={() => run(() => actions.decide(match.id, "accept"))} disabled={pending}>
                {pending ? <Spinner /> : <CheckIcon />} Potwierdź
              </Button>
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
