"use client";

import { PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, RiskEvent } from "@/lib/rm/types";

export type RiskEventPatch = {
  risk_code: string;
  title: string;
  cause: string;
  impact: string;
  mitigation: string;
  delay_days: number | null;
  cost_pln: number | null;
};

type Props = {
  event: RiskEvent;
  catalog: CatalogEntry[];
  onSave: (id: string, patch: RiskEventPatch, comment?: string) => Promise<ActionResult>;
  disabled?: boolean;
  size?: "sm" | "default";
};

/** Okno poprawy zdarzenia ryzyka (zapis = zatwierdzenie + wpis w historii decyzji). */
export function RiskEventEditDialog({ event, catalog, onSave, disabled, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const onSubmit = (form: FormData) => {
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
    start(async () => {
      const result = await onSave(event.id, patch, String(form.get("comment") ?? ""));
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else toast.error(result.message);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline" disabled={disabled || pending}>
          <PencilIcon /> Popraw
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Popraw zdarzenie</DialogTitle>
          <DialogDescription>Zapis zatwierdza zdarzenie.</DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
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
              <FieldLabel htmlFor={`comment-${event.id}`}>Komentarz</FieldLabel>
              <Input id={`comment-${event.id}`} name="comment" />
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
  );
}
