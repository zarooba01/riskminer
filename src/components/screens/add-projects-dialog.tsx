"use client";

import { CheckCircle2Icon, DownloadIcon, FileUpIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProgressSteps, type ProgressStep } from "@/components/rm/progress-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { plural, type ActionResult } from "@/lib/rm/format";

export type AddProjectsResult = ActionResult & {
  added: string[];
  skipped: { id: string; title: string; reason: string }[];
  warnings: string[];
};

type Outcome = "matched" | "proposed" | "none" | "contract" | "no_contract" | "pending_match";
type StepAction = (projectId: string) => Promise<ActionResult & { projectId: string; outcome?: Outcome }>;
type StepSummary = { summary: string; details: { text: string; status: "ok" | "error" | "info" }[] };

const ids = (list: string[]) => list.sort().join(", ");

/** Podział wyników wyszukiwania: dopasowane pewnie (zatwierdzone automatycznie), do potwierdzenia, nie znalezione. */
function summarizeSearch(byOutcome: Map<Outcome, string[]>, total: number): StepSummary {
  const matched = byOutcome.get("matched") ?? [];
  const proposed = byOutcome.get("proposed") ?? [];
  const none = byOutcome.get("none") ?? [];
  const extra = [proposed.length ? `do potwierdzenia ${proposed.length}` : "", none.length ? `nie znaleziono ${none.length}` : ""].filter(Boolean).join(", ");
  const details: StepSummary["details"] = [{ text: `Dopasowane pewnie (po numerze BZP i NIP): ${matched.length}`, status: "ok" }];
  if (proposed.length) details.push({ text: `Wymagają potwierdzenia dopasowania w Weryfikacji (${proposed.length}): ${ids(proposed)}`, status: "info" });
  if (none.length) details.push({ text: `Nie znaleziono w BZP (${none.length}): ${ids(none)}`, status: "error" });
  return { summary: `Dopasowano ${matched.length} z ${total}${extra ? `; ${extra}` : ""}.`, details };
}

/**
 * Podział wyników wzbogacania. Wzbogacamy tylko projekty dopasowane pewnie — pozostałe nie są przetwarzane
 * i są wymienione z powodem (czekają na potwierdzenie albo brak przetargu).
 */
const summarizeBuild =
  (allTotal: number, waiting: string[], notFound: string[]) =>
  (byOutcome: Map<Outcome, string[]>): StepSummary => {
    const withContract = byOutcome.get("contract") ?? [];
    const without = byOutcome.get("no_contract") ?? [];
    const details: StepSummary["details"] = [{ text: `Odtworzona umowa, koszt i czas: ${withContract.length}`, status: "ok" }];
    if (without.length) details.push({ text: `Brak ogłoszeń o umowie w BZP (${without.length}): ${ids(without)}`, status: "info" });
    if (waiting.length) details.push({ text: `Nie wzbogacono — czekają na potwierdzenie dopasowania (${waiting.length}): ${ids([...waiting])}`, status: "info" });
    if (notFound.length) details.push({ text: `Nie wzbogacono — brak przetargu (${notFound.length}): ${ids([...notFound])}`, status: "info" });
    return { summary: `Wzbogacono ${withContract.length} z ${allTotal}.`, details };
  };

export type AddProjectsDialogProps = {
  addAction: (state: AddProjectsResult | null, form: FormData) => Promise<AddProjectsResult>;
  /** Etap b (domyślnie POST /api/projects/<id>/search); nadpisywane w Storybooku. */
  searchAction?: StepAction;
  /** Etap c (domyślnie POST /api/projects/<id>/build); nadpisywane w Storybooku. */
  buildAction?: StepAction;
};

/**
 * Etapy b i c wołamy przez endpointy API, nie server actions: Next.js wykonuje server actions z przeglądarki
 * po kolei, a tu przetwarzamy kilka projektów równolegle.
 */
const viaApi =
  (step: "search" | "build"): StepAction =>
  async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/${step}`, { method: "POST" });
      const body = await response.json().catch(() => null);
      return body?.message ? body : { ok: false, projectId, message: `${projectId}: błąd serwera (${response.status})` };
    } catch {
      return { ok: false, projectId, message: `${projectId}: brak połączenia z serwerem` };
    }
  };

type Phase = "form" | "running" | "finished";

/** Etap widoczny co najmniej tyle, żeby dało się przeczytać jego status (bez sztucznych kroków). */
const MIN_STEP_MS = 600;
/** Ile projektów przetwarzamy równolegle (kopia BZP nie ma limitu zapytań; produkcyjne API: 30/min). */
const CONCURRENCY = 6;
/** Zgodnie z serverActions.bodySizeLimit w next.config.ts. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const atLeast = async <T,>(promise: Promise<T>, started: number) => {
  const result = await promise;
  const left = MIN_STEP_MS - (Date.now() - started);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  return result;
};

const initialSteps = (): ProgressStep[] => [
  { id: "import", title: "Importowanie danych", state: "pending" },
  { id: "search", title: "Wyszukiwanie w źródłach publicznych (BZP)", state: "pending" },
  { id: "build", title: "Wzbogacanie danych", state: "pending" },
];

/**
 * Import projektów z pliku XLSX/CSV w jednym kroku: import → wyszukiwanie w BZP → wzbogacanie.
 * Każdy etap pokazuje rzeczywistą pracę i zostaje na ekranie z zieloną fajką po zakończeniu.
 */
export function AddProjectsDialog({ addAction, searchAction = viaApi("search"), buildAction = viaApi("build") }: AddProjectsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [added, setAdded] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  const update = (id: string, patch: Partial<ProgressStep> | ((s: ProgressStep) => Partial<ProgressStep>)) =>
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s)));

  const reset = () => {
    setPhase("form");
    setSteps(initialSteps());
    setAdded([]);
    setFailed(false);
  };

  /**
   * Etap wykonywany dla wielu projektów naraz (pula CONCURRENCY); błąd jednego projektu nie przerywa pozostałych.
   * Wyniki dopisują się w kolejności ukończenia.
   */
  const runPerProject = async (
    id: string,
    ids: string[],
    action: StepAction | undefined,
    verb: string,
    summarize?: (byOutcome: Map<Outcome, string[]>, total: number) => StepSummary,
  ): Promise<Map<Outcome, string[]>> => {
    if (!action) {
      update(id, { state: "skipped", summary: "pominięto — etap niedostępny" });
      return new Map();
    }
    const started = Date.now();
    const counter = (n: number) => update(id, { progress: { done: n, total: ids.length }, current: `${verb}: ${n}/${ids.length}` });
    update(id, { state: "running", details: [] });
    counter(0);
    const queue = [...ids];
    let ok = 0;
    let done = 0;
    const byOutcome = new Map<Outcome, string[]>();

    const worker = async () => {
      for (let projectId = queue.shift(); projectId; projectId = queue.shift()) {
        const result = await action(projectId);
        done++;
        if (result.ok) ok++;
        if (result.outcome) byOutcome.set(result.outcome, [...(byOutcome.get(result.outcome) ?? []), projectId]);
        // Pod etapem tylko błędy (żeby było wiadomo, który projekt nie przeszedł); udane — sam licznik.
        else update(id, (s) => ({ details: [...(s.details ?? []), { text: result.message, status: "error" as const }] }));
        counter(done);
      }
    };
    await atLeast(Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker)), started);

    const all = ok === ids.length;
    const split = summarize?.(byOutcome, ids.length);
    const errors = ids.length - ok;
    update(id, (s) => ({
      state: ok ? "done" : "error",
      summary: split
        ? `${split.summary}${errors ? ` Błędy: ${errors}.` : ""}`
        : all
          ? `Zakończono dla ${ids.length} inwestycji.`
          : `Zakończono: ${ok} z ${ids.length}, błędy: ${errors}.`,
      details: [...(split?.details ?? []), ...(s.details ?? [])],
      current: undefined,
    }));
    if (!all) setFailed(true);
    return byOutcome;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > MAX_FILE_BYTES) {
      setPhase("running");
      setSteps(initialSteps());
      update("import", { state: "error", summary: `Plik ma ${(file.size / 1024 / 1024).toFixed(1)} MB — maksymalnie 4 MB. Podziel go na mniejsze części.` });
      update("search", { state: "skipped", summary: "przerwano" });
      update("build", { state: "skipped", summary: "przerwano" });
      setFailed(true);
      setPhase("finished");
      return;
    }

    setPhase("running");
    setSteps(initialSteps());

    // a) Importowanie danych
    const started = Date.now();
    update("import", { state: "running", current: `Wczytuję plik ${file.name} i sprawdzam duplikaty…` });
    const result = await atLeast(addAction(null, form), started);
    if (!result.ok) {
      const shown = result.warnings.slice(0, 5).map((w) => ({ text: w, status: "info" as const }));
      if (result.warnings.length > 5) shown.push({ text: `…i ${result.warnings.length - 5} więcej`, status: "info" as const });
      update("import", { state: "error", summary: result.message, current: undefined, details: shown });
      update("search", { state: "skipped", summary: "przerwano" });
      update("build", { state: "skipped", summary: "przerwano" });
      setFailed(true);
      setPhase("finished");
      return;
    }
    update("import", {
      state: "done",
      current: undefined,
      summary: `Dodano ${result.added.length} z ${result.added.length + result.skipped.length} ${result.added.length + result.skipped.length === 1 ? "rekordu" : "rekordów"}`,
    });
    setAdded(result.added);

    if (!result.added.length) {
      update("search", { state: "skipped", summary: "pominięto — brak nowych inwestycji" });
      update("build", { state: "skipped", summary: "pominięto — brak nowych inwestycji" });
      setPhase("finished");
      return;
    }

    // b) Wyszukiwanie w źródłach publicznych, c) Wzbogacanie danych
    const search = await runPerProject("search", result.added, searchAction, "Przeszukano BZP", summarizeSearch);
    // c) Wzbogacamy wyłącznie projekty dopasowane pewnie; niepewne czekają na decyzję eksperta.
    const matched = search.get("matched") ?? [];
    const waiting = search.get("proposed") ?? [];
    const notFound = search.get("none") ?? [];
    if (matched.length) {
      await runPerProject("build", matched, buildAction, "Wzbogacono", summarizeBuild(result.added.length, waiting, notFound));
    } else {
      const split = summarizeBuild(result.added.length, waiting, notFound)(new Map());
      update("build", { state: "skipped", summary: "Nic do wzbogacenia — brak pewnie dopasowanych inwestycji.", details: split.details.slice(1) });
    }

    setPhase("finished");
    router.refresh();
  };

  const running = phase === "running";
  const close = () => {
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return; // w trakcie importu okno zostaje otwarte
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <FileUpIcon /> Importuj inwestycje
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!running}
        onInteractOutside={(e) => running && e.preventDefault()}
        onEscapeKeyDown={(e) => running && e.preventDefault()}
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Importuj inwestycje z pliku</DialogTitle>
          <DialogDescription>{phase === "form" ? "Duplikaty zostaną pominięte." : "Import, wyszukiwanie w BZP i wzbogacenie danych."}</DialogDescription>
        </DialogHeader>

        {phase === "form" ? (
          <>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="add-file">Plik .xlsx lub .csv</FieldLabel>
                <Input id="add-file" name="file" type="file" accept=".xlsx,.csv" required />
              </Field>
              <Button type="submit" className="self-center">
                <FileUpIcon /> Importuj inwestycje
              </Button>
            </form>
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Nie masz pliku? Pobierz szablon</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/projects/template?format=xlsx" download>
                    <DownloadIcon /> Szablon XLSX
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/projects/template?format=csv" download>
                    <DownloadIcon /> Szablon CSV
                  </a>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <ProgressSteps steps={steps} />
            {phase === "finished" && added.length > 0 && (
              <Alert className="border-success/40 bg-success/10">
                <CheckCircle2Icon className="text-success!" />
                <AlertTitle>{failed ? "Gotowe, z uwagami" : "Gotowe"}</AlertTitle>
                <AlertDescription>Dodano {plural(added.length, ["inwestycję", "inwestycje", "inwestycji"])}.</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {phase === "finished" && (
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              <RotateCcwIcon /> Importuj kolejny plik
            </Button>
            <Button onClick={close}>Zamknij</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
