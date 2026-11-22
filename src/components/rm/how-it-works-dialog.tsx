import { InfoIcon, UserCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Kroki jak na slajdzie „Jak to działa” w prezentacji (RiskMiner/prezentacja). */
const steps = [
  { title: "Import danych", text: "Wczytanie pliku z listą inwestycji.", expert: false },
  { title: "Wzbogacenie danych", text: "Automatyczne wyszukanie w BZP, TED i na stronach zamawiających.", expert: true },
  { title: "Wykrycie zdarzeń", text: "Reguły (deterministycznie) lub AI, zawsze z cytatem ze źródła.", expert: true },
  { title: "Kategoryzacja ryzyk", text: "Zdarzenia przypisane do katalogu ryzyk R01–R15.", expert: true },
  { title: "Baza doświadczeń", text: "Zatwierdzony, kompletny zbiór danych.", expert: false },
  { title: "Ocena nowej inwestycji", text: "Prognoza kosztu, czasu i ryzyk na podstawie bazy doświadczeń.", expert: false },
];

/** Przycisk w nagłówku Pulpitu otwierający opis procesu — pomoc na żądanie, nie zajmuje miejsca na stronie. */
export function HowItWorksDialog({ model }: { model: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <InfoIcon aria-hidden /> Jak to działa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Jak to działa</DialogTitle>
          <DialogDescription>Od listy inwestycji do oceny nowego przedsięwzięcia — w sześciu krokach.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px bg-border" aria-hidden />}
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 pt-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {step.title}
                  {step.expert && (
                    <Badge variant="secondary">
                      <UserCheckIcon aria-hidden /> decyzja eksperta
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="rounded-lg bg-muted p-3 text-muted-foreground">
          Algorytmy i AI podpowiadają, ale to ekspert decyduje. Na etapach wzbogacenia, wykrycia zdarzeń i kategoryzacji ryzyk (kroki 2–4) zatwierdza
          lub odrzuca każdą propozycję — do bazy doświadczeń trafiają wyłącznie dane, których poprawność potwierdził człowiek.
        </p>
        <p className="text-xs text-muted-foreground">
          Model produkcyjny: <span className="font-mono">{model}</span> (zmiana w zmiennej LLM_MODEL, bez zmian w kodzie).
        </p>
      </DialogContent>
    </Dialog>
  );
}
