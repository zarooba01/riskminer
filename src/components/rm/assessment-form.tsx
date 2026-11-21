"use client";

import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ProgressSteps, type ProgressStep } from "./progress-steps";

/** Przykład z opisu wyzwania (demo dla jury) — wszystko w jednym opisie, parametry odczytamy z tekstu. */
export const demoExample =
  "Chcemy wybudować kanalizację sanitarną w Góraszce (gmina Wiązowna, województwo mazowieckie). Około 3 km sieci grawitacyjno-tłocznej z przepompownią i przyłączami, budżet 4 mln zł, czas realizacji 12 miesięcy. " +
  "Znane warunki: włączenie do istniejącej sieci kanalizacyjnej w sąsiedniej miejscowości, uzgodnienia z zarządcą drogi powiatowej, możliwe kolizje z uzbrojeniem (gaz, telekomunikacja).";

type Phase = "form" | "running" | "error";

type Props = {
  /** Model i region przetwarzania — do opisu pola „Użyj modelu AI”. */
  model?: string;
  region?: string;
};

const initialSteps = (files: number, ai: boolean): ProgressStep[] => [
  { id: "save", title: files ? `Zapis opisu i odczyt ${files > 1 ? `${files} dokumentów` : "dokumentu"}` : "Zapis opisu inwestycji", state: "pending" },
  {
    id: "run",
    title: ai
      ? "Analiza modelem AI: dobór podobnych inwestycji, ryzyka i zalecenia (liczby z danych wybranych przypadków)"
      : "Ocena deterministyczna: dobór podobnych inwestycji, statystyka odchyleń, ryzyka i zalecenia (bez AI)",
    state: "pending",
  },
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

/** Formularz nowej oceny: opis językiem naturalnym i/lub dokumenty; opcjonalnie analiza modelem AI. */
export function AssessmentForm({ model, region }: Props) {
  const router = useRouter();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps(0, false));
  const [error, setError] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const update = (id: string, patch: Partial<ProgressStep>) => setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    form.delete("file");
    files.forEach((f) => form.append("file", f));
    if (!String(form.get("description") ?? "").trim() && !files.length) {
      setError("Opisz planowaną inwestycję albo dołącz dokument (PDF lub DOCX).");
      return;
    }
    setError(null);
    if (useAi) form.set("mode", "ai");
    setSteps(initialSteps(files.length, useAi));
    setPhase("running");

    update("save", { state: "running", current: files.length ? `Czytam ${files.map((f) => f.name).join(", ")}…` : "Zapisuję…" });
    const created = await post("/api/assessments", form);
    if (!created.ok) {
      update("save", { state: "error", summary: created.message, current: undefined });
      update("run", { state: "skipped", summary: "przerwano" });
      setPhase("error");
      return;
    }
    setCreatedId(created.id);
    update("save", { state: "done", summary: created.message, current: undefined });
    update("run", { state: "running", current: useAi ? `Model ${model ?? ""} analizuje opis i bazę porównawczą…` : "Porównuję z zakończonymi inwestycjami w bazie porównawczej…" });
    const ran = await post(`/api/assessments/${created.id}/run`);
    if (!ran.ok) {
      update("run", { state: "error", summary: ran.message, current: undefined });
      setPhase("error");
      return;
    }
    update("run", { state: "done", summary: ran.message, current: undefined });
    router.push(`/assessments/${created.id}`);
  };

  if (phase !== "form") {
    return (
      <div className="flex flex-col gap-4">
        <ProgressSteps steps={steps} />
        {phase === "error" && (
          <div className="flex flex-wrap gap-2">
            {createdId && (
              <Button onClick={() => router.push(`/assessments/${createdId}`)}>Otwórz ocenę</Button>
            )}
            <Button variant="outline" onClick={() => setPhase("form")}>
              Wróć do formularza
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="description">Opis planowanej inwestycji</FieldLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (textRef.current) textRef.current.value = demoExample;
            }}
          >
            <SparklesIcon aria-hidden /> Wstaw przykład (Góraszka)
          </Button>
        </div>
        <Textarea
          ref={textRef}
          id="description"
          name="description"
          rows={6}
          placeholder="Np. Chcemy wybudować kanalizację sanitarną w Góraszce (woj. mazowieckie). Około 3 km sieci, budżet 4 mln zł, 12 miesięcy. Znane warunki: włączenie do istniejącej sieci, uzgodnienia z zarządcą drogi, kolizje z uzbrojeniem."
        />
        <FieldDescription>
          Zwykłym językiem: co, gdzie, ile (długość, budżet), na kiedy i jakie znane warunki lokalne. Parametry odczytamy z tekstu — w wyniku zobaczysz, co
          odczytano, i poprawisz to w zakładce „Założenia”.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="file">Dokumenty planu (opcjonalnie)</FieldLabel>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" multiple />
        <FieldDescription>Do 5 plików PDF (z warstwą tekstową) lub DOCX, każdy do 4 MB — np. koncepcja, PFU, studium wykonalności. Wystarczy sam dokument, bez opisu.</FieldDescription>
      </Field>

      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox id="use-ai" checked={useAi} onCheckedChange={(v) => setUseAi(v === true)} className="mt-0.5" />
        <div className="flex flex-col gap-1">
          <Label htmlFor="use-ai">Użyj modelu AI do analizy</Label>
          <p className="text-xs text-muted-foreground">
            Zamiast oceny deterministycznej: model odczyta opis i dokumenty, wybierze podobne inwestycje z bazy porównawczej i zaproponuje ryzyka, rzeczy do sprawdzenia,
            działania i zapisy umowne — każdy wniosek musi wskazywać przypadek lub zdarzenie, inaczej zostanie odrzucony. Mediany, przedziały i liczebność liczymy z danych
            wybranych przypadków. Jedno płatne wywołanie (ułamek centa; ten sam opis drugi raz — bez kosztu, z pamięci podręcznej)
            {model ? (
              <>
                , model <span className="font-mono">{model}</span>, przetwarzanie: {region}
              </>
            ) : null}
            . Bez zaznaczenia — ocena deterministyczna (reguły i obliczenia, bez AI).
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="self-start">
        Oceń inwestycję
      </Button>
    </form>
  );
}
