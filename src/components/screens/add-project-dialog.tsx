"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { projectColumns } from "@/lib/ingest/columns";
import type { ActionResult } from "@/lib/rm/format";

export type AddProjectResult = ActionResult & { projectId?: string; fieldErrors?: Partial<Record<string, string>> };

export type AddProjectDialogProps = {
  addProject: (form: FormData) => Promise<AddProjectResult>;
  enrichAction?: (projectId: string) => Promise<ActionResult>;
  /** Proponowany kolejny identyfikator, np. RM-2026-023. */
  suggestedId?: string;
};

const provinces: [string, string][] = [
  ["02", "dolnośląskie"],
  ["04", "kujawsko-pomorskie"],
  ["06", "lubelskie"],
  ["08", "lubuskie"],
  ["10", "łódzkie"],
  ["12", "małopolskie"],
  ["14", "mazowieckie"],
  ["16", "opolskie"],
  ["18", "podkarpackie"],
  ["20", "podlaskie"],
  ["22", "pomorskie"],
  ["24", "śląskie"],
  ["26", "świętokrzyskie"],
  ["28", "warmińsko-mazurskie"],
  ["30", "wielkopolskie"],
  ["32", "zachodniopomorskie"],
];

const hint = (header: string) => projectColumns.find((c) => c.header === header);

/** Pole formularza: nazwa = nagłówek kolumny z szablonu (te same reguły co import pliku). */
function TextField({ header, errors, multiline, placeholder, defaultValue }: { header: string; errors: Partial<Record<string, string>>; multiline?: boolean; placeholder?: string; defaultValue?: string }) {
  const column = hint(header);
  const id = `f-${header.replace(/\W+/g, "-")}`;
  const error = errors[header];
  const Control = multiline ? Textarea : Input;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {header}
        {column?.required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Control id={id} name={header} placeholder={placeholder ?? column?.example} defaultValue={defaultValue} required={column?.required} aria-invalid={Boolean(error)} />
      {error ? <FieldError>{error}</FieldError> : column?.description && <FieldDescription>{column.description}</FieldDescription>}
    </Field>
  );
}

/**
 * Dodanie jednego projektu. Modal zamyka się wyłącznie przyciskiem „Anuluj” (albo po zapisie) —
 * kliknięcie poza oknem ani klawisz Esc nie gubią wpisanych danych.
 */
export function AddProjectDialog({ addProject, enrichAction, suggestedId }: AddProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [province, setProvince] = useState("");
  const [scope, setScope] = useState("całe postępowanie");
  const [part, setPart] = useState("1");
  const [enrich, setEnrich] = useState(true);
  const [formKey, setFormKey] = useState(0);

  const reset = () => {
    setErrors({});
    setMessage(null);
    setProvince("");
    setScope("całe postępowanie");
    setPart("1");
    setFormKey((k) => k + 1);
  };

  const cancel = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("Zakres rekordu", scope === "część" ? `część ${part}` : scope);
    const code = provinces.find(([, name]) => name === province)?.[0] ?? "";
    form.set("Kod województwa (TERYT)", code);
    form.set("Województwo", province);

    start(async () => {
      const result = await addProject(form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      reset();
      if (result.projectId && enrich && enrichAction) {
        toast.info(`Wzbogacam ${result.projectId} danymi z BZP…`);
        const enriched = await enrichAction(result.projectId);
        if (enriched.ok) toast.success(enriched.message);
        else toast.error(enriched.message);
      }
      if (result.projectId) router.push(`/projects/${encodeURIComponent(result.projectId)}`);
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon /> Dodaj projekt
      </Button>
      <Dialog open={open} onOpenChange={(next) => next && setOpen(true)}>
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-h-[92svh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>Nowy projekt</DialogTitle>
            <DialogDescription>
              Pola odpowiadają kolumnom szablonu XLSX. Wymagane: identyfikator i nazwa; NIP, województwo i numer BZP/KPO pozwalają automatycznie odnaleźć przetarg w BZP.
            </DialogDescription>
          </DialogHeader>

          <form key={formKey} id="add-project-form" onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
            <FieldSet>
              <FieldLegend>Przedsięwzięcie</FieldLegend>
              <FieldGroup>
                <TextField header="Identyfikator rekordu" errors={errors} defaultValue={suggestedId} />
                <TextField header="Nazwa przedsięwzięcia" errors={errors} multiline placeholder="np. Budowa sieci kanalizacji sanitarnej w miejscowości …" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="f-scope">Zakres rekordu</FieldLabel>
                    <Select value={scope} onValueChange={setScope}>
                      <SelectTrigger id="f-scope" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="całe postępowanie">całe postępowanie</SelectItem>
                        <SelectItem value="część">część postępowania</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {scope === "część" && (
                    <Field>
                      <FieldLabel htmlFor="f-part">Numer części</FieldLabel>
                      <Input id="f-part" inputMode="numeric" value={part} onChange={(e) => setPart(e.target.value.replace(/\D/g, ""))} />
                    </Field>
                  )}
                  <Field>
                      <FieldLabel htmlFor="f-status">Status przedsięwzięcia</FieldLabel>
                      <Select name="Status przedsięwzięcia" defaultValue="Zakończone">
                        <SelectTrigger id="f-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Zakończone">Zakończone</SelectItem>
                          <SelectItem value="W realizacji">W realizacji</SelectItem>
                          <SelectItem value="Planowane">Planowane</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                </div>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Zamawiający</FieldLegend>
              <FieldGroup>
                <TextField header="Nazwa odbiorcy" errors={errors} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField header="Identyfikator odbiorcy" errors={errors} placeholder="NIP, 10 cyfr" />
                  <TextField header="Siedziba odbiorcy" errors={errors} />
                </div>
                <Field>
                  <FieldLabel htmlFor="f-province">Województwo</FieldLabel>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger id="f-province" className="w-full">
                      <SelectValue placeholder="Wybierz (kod TERYT uzupełni się sam)" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map(([code, name]) => (
                        <SelectItem key={code} value={name}>
                          {name} ({code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Potrzebne do wyszukania przetargu w BZP, gdy nie ma numeru ogłoszenia.</FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Identyfikator publiczny</FieldLegend>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel htmlFor="f-idtype">Rodzaj</FieldLabel>
                    <Select name="Rodzaj identyfikatora publicznego" defaultValue="Ogłoszenie BZP">
                      <SelectTrigger id="f-idtype" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ogłoszenie BZP">Ogłoszenie BZP</SelectItem>
                        <SelectItem value="Projekt KPO">Projekt KPO</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <TextField header="Identyfikator publiczny" errors={errors} placeholder="2022/BZP 00058537/01 albo KPOD.03.15-…" />
                </div>
              </FieldGroup>
            </FieldSet>

            <TextField header="Adnotacja instytucji" errors={errors} multiline />

            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={enrich} onCheckedChange={(v) => setEnrich(Boolean(v))} disabled={!enrichAction} />
              Po dodaniu od razu wzbogać projekt danymi z BZP
            </Label>

            {message && <p className="text-sm text-destructive">{message}</p>}
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={cancel} disabled={pending}>
              Anuluj
            </Button>
            <Button type="submit" form="add-project-form" disabled={pending}>
              {pending ? <Spinner /> : <PlusIcon />} Dodaj projekt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
