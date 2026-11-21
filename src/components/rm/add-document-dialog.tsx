"use client";

import { CheckCircle2Icon, FileUpIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ProgressSteps, type ProgressStep } from "./progress-steps";

export const documentTypeOptions = ["aneks", "umowa", "SWZ / PFU / OPZ", "protokół odbioru", "protokół konieczności", "korespondencja", "inny"];

type Props = {
  projectId: string;
  contracts: { id: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Phase = "form" | "running" | "finished";

const initialSteps = (): ProgressStep[] => [
  { id: "read", title: "Odczyt dokumentu", state: "pending" },
  { id: "analyze", title: "Porównanie z danymi sprawy (AI)", state: "pending" },
];

async function post(url: string, body?: FormData) {
  try {
    const response = await fetch(url, { method: "POST", body });
    const json = await response.json().catch(() => null);
    return json?.message ? json : { ok: false, message: `Błąd serwera (${response.status})` };
  } catch {
    return { ok: false, message: "Brak połączenia z serwerem" };
  }
}

/**
 * Dodanie PDF/DOCX do istniejącej inwestycji: odczyt pliku (bez AI), potem porównanie z danymi sprawy (AI).
 * Wynik — ustalenia potwierdza / uzupełnia / rozbieżności i propozycje zdarzeń — trafia do weryfikacji eksperta.
 */
export function AddDocumentDialog({ projectId, contracts, open, onOpenChange }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [docType, setDocType] = useState("aneks");
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const update = (id: string, patch: Partial<ProgressStep>) => setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const reset = () => {
    setPhase("form");
    setSteps(initialSteps());
    setResult(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    form.set("doc_type", docType);
    if (contractId) form.set("contract_id", contractId);

    setPhase("running");
    update("read", { state: "running", current: `Czytam ${file.name}…` });
    const stored = await post(`/api/projects/${encodeURIComponent(projectId)}/documents`, form);
    if (!stored.ok) {
      update("read", { state: "error", summary: stored.message, current: undefined });
      update("analyze", { state: "skipped", summary: "przerwano" });
      setResult(stored);
      setPhase("finished");
      return;
    }
    update("read", { state: "done", summary: stored.message, current: undefined });

    update("analyze", { state: "running", current: "Model porównuje dokument z danymi z BZP…" });
    const analyzed = await post(`/api/projects/${encodeURIComponent(projectId)}/documents/${stored.documentId}/analyze`);
    update("analyze", { state: analyzed.ok ? "done" : "error", summary: analyzed.message, current: undefined });
    setResult(analyzed.ok ? { ok: true, message: "Dokument dodany. Ustalenia czekają na decyzję w zakładce Dokumenty." } : { ok: false, message: "Dokument zapisany, ale analiza AI się nie powiodła — możesz ją ponowić na karcie dokumentu." });
    setPhase("finished");
    router.refresh();
  };

  const running = phase === "running";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent showCloseButton={!running} onInteractOutside={(e) => running && e.preventDefault()} onEscapeKeyDown={(e) => running && e.preventDefault()} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dodaj dokument</DialogTitle>
          <DialogDescription>PDF z warstwą tekstową albo DOCX, do 4 MB.</DialogDescription>
        </DialogHeader>

        {phase === "form" ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="doc-file">Plik</FieldLabel>
              <Input id="doc-file" name="file" type="file" accept=".pdf,.docx" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="doc-type">Rodzaj dokumentu</FieldLabel>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger id="doc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {contracts.length > 1 && (
              <Field>
                <FieldLabel htmlFor="doc-contract">Umowa, której dotyczy</FieldLabel>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger id="doc-contract" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Przetarg ma kilka umów (części) — wskaż właściwą.</FieldDescription>
              </Field>
            )}
            <Button type="submit" className="self-center">
              <FileUpIcon /> Dodaj i przeanalizuj
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <ProgressSteps steps={steps} />
            {phase === "finished" && result && (
              <Alert className={result.ok ? "border-success/40 bg-success/10" : undefined} variant={result.ok ? "default" : "destructive"}>
                {result.ok && <CheckCircle2Icon className="text-success!" />}
                <AlertTitle>{result.ok ? "Gotowe" : "Uwaga"}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {phase === "finished" && (
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              <RotateCcwIcon /> Dodaj kolejny
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Zamknij
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
