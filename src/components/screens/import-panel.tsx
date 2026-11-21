"use client";

import { DatabaseZapIcon, FileUpIcon, PlayIcon } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";

export type ImportPanelProps = {
  projectIds: string[];
  importAction: (state: ActionResult | null, form: FormData) => Promise<ActionResult>;
  enrichAction: (projectId: string) => Promise<ActionResult>;
};

/** Ścieżka 1 demonstracji: import pliku i automatyczne wzbogacenie z BZP (projekt po projekcie, bez limitu czasu funkcji). */
export function ImportPanel({ projectIds, importAction, enrichAction }: ImportPanelProps) {
  const [state, formAction, importing] = useActionState(importAction, null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<ActionResult[]>([]);

  const enrichAll = () =>
    start(async () => {
      setDone(0);
      setLog([]);
      for (const id of projectIds) {
        const result = await enrichAction(id);
        setLog((prev) => [result, ...prev]);
        setDone((d) => d + 1);
      }
      toast.success("Wzbogacanie zakończone.");
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUpIcon className="size-4" aria-hidden /> 1. Import rekordów
          </CardTitle>
          <CardDescription>Plik XLSX/CSV w formacie organizatora. Bez pliku wczytamy dołączony zestaw 22 projektów.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="file">Plik .xlsx lub .csv (opcjonalnie)</FieldLabel>
              <Input id="file" name="file" type="file" accept=".xlsx,.csv" />
              <FieldDescription>Ponowny import aktualizuje rekordy o tym samym identyfikatorze.</FieldDescription>
            </Field>
            <Button type="submit" disabled={importing}>
              {importing ? <Spinner /> : <DatabaseZapIcon />} Importuj
            </Button>
            {state && (
              <Alert variant={state.ok ? "default" : "destructive"}>
                <AlertTitle>{state.ok ? "Gotowe" : "Błąd importu"}</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayIcon className="size-4" aria-hidden /> 2. Wzbogacenie z BZP
          </CardTitle>
          <CardDescription>
            Dla każdego projektu: ogłoszenie o zamówieniu → wynik → zmiany → wykonanie umowy (łączenie po numerze BZP, NIP i OCID). Koszt LLM: 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={enrichAll} disabled={pending || !projectIds.length}>
            {pending ? <Spinner /> : <PlayIcon />} Wzbogać wszystkie ({projectIds.length})
          </Button>
          {(pending || done > 0) && (
            <div className="flex flex-col gap-2">
              <Progress value={projectIds.length ? (done / projectIds.length) * 100 : 0} aria-label="Postęp wzbogacania" />
              <p className="text-xs text-muted-foreground">
                {done} / {projectIds.length}
              </p>
              <ul className="max-h-48 overflow-y-auto text-xs">
                {log.map((entry, i) => (
                  <li key={i} className={entry.ok ? "text-muted-foreground" : "text-destructive"}>
                    {entry.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
