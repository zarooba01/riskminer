"use client";

import { BookOpenCheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/rm/format";
import type { CatalogEntry } from "@/lib/rm/types";

export type GuidancePatch = { checks: string[]; actions: string[]; clauses: string[] };

const fields = [
  ["checks", "Co sprawdzić przed przetargiem"],
  ["actions", "Działania do rozważenia"],
  ["clauses", "Zapisy umowne, które mogą pomóc"],
] as const;

/** Edycja wiedzy eksperckiej kategorii (jedna pozycja na linię) — trafia do ocen nowych inwestycji bez zmian w kodzie. */
export function CatalogGuidanceDialog({ entry, save }: { entry: CatalogEntry; save: (code: string, patch: GuidancePatch) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [values, setValues] = useState(() => ({
    checks: (entry.checks ?? []).join("\n"),
    actions: (entry.actions ?? []).join("\n"),
    clauses: (entry.clauses ?? []).join("\n"),
  }));
  const count = (entry.checks?.length ?? 0) + (entry.actions?.length ?? 0) + (entry.clauses?.length ?? 0);

  const onSave = () =>
    start(async () => {
      const split = (s: string) => s.split("\n");
      const result = await save(entry.code, { checks: split(values.checks), actions: split(values.actions), clauses: split(values.clauses) });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else toast.error(result.message);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Wiedza ekspercka ${entry.code}`}>
          <BookOpenCheckIcon aria-hidden /> Zalecenia ({count})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry.code} {entry.name}
          </DialogTitle>
          <DialogDescription>Wiedza ekspercka używana w ocenie nowych inwestycji. Jedna pozycja na linię. Zmiana zadziała po aktualizacji oceny.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {fields.map(([key, label]) => (
            <Field key={key}>
              <FieldLabel htmlFor={`g-${entry.code}-${key}`}>{label}</FieldLabel>
              <Textarea id={`g-${entry.code}-${key}`} rows={4} value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
            </Field>
          ))}
          <FieldDescription>Każda zmiana jest zapisywana w historii decyzji (było → jest).</FieldDescription>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Anuluj
          </Button>
          <Button onClick={onSave} disabled={pending}>
            {pending ? (
              <>
                <Spinner /> Zapisuję…
              </>
            ) : (
              "Zapisz"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
