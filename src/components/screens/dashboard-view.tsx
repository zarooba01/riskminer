import { AlertTriangleIcon, BotIcon, CheckCircle2Icon, ClipboardCheckIcon, DatabaseIcon, FileDownIcon, FileSearchIcon, FolderKanbanIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usd } from "@/lib/rm/format";

import { ImportPanel, type ImportPanelProps } from "./import-panel";

export type DashboardStatsView = {
  projects: number;
  enriched: number;
  notices: number;
  contracts: number;
  proposed: number;
  accepted: number;
  runs: number;
  costUsd: number;
};

type Props = ImportPanelProps & {
  stats: DashboardStatsView | null;
  model: string;
  configError?: string;
};

const steps = [
  { title: "Import", text: "Plik XLSX → rekordy projektów, walidacja NIP, podsektory wg słownika eksperckiego." },
  { title: "Łączenie", text: "BZP: numer ogłoszenia → OCID postępowania → wynik, zmiany i wykonanie umowy. Rekordy KPO: wyszukiwanie po NIP z oceną pewności." },
  { title: "Fakty i reguły", text: "Kwoty, terminy, zmiany art. 455 parsowane z formularzy. Odchylenia liczone bez AI." },
  { title: "Model AI", text: "Klasyfikacja przyczyn i skutków do katalogu R01–R15, z cytatem ze źródła." },
  { title: "Ekspert", text: "Zatwierdza, poprawia lub odrzuca. Wzorcowe przykłady wracają do kolejnych analiz." },
];

export function DashboardView({ stats, model, configError, ...importProps }: Props) {
  return (
    <>
      <PageHeader
        title="Risk Miner"
        description="Baza doświadczeń inwestycji wodno-kanalizacyjnych: od rozproszonych ogłoszeń do zweryfikowanych zdarzeń ryzyka."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/export">
                <FileDownIcon aria-hidden /> Eksport danych
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/review">Kolejka weryfikacji ({stats?.proposed ?? 0})</Link>
            </Button>
          </>
        }
      />
      {configError && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Baza danych nie jest skonfigurowana</AlertTitle>
          <AlertDescription>{configError}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projekty" value={String(stats?.projects ?? 0)} icon={FolderKanbanIcon} hint={`wzbogacone: ${stats?.enriched ?? 0}`} />
        <StatCard label="Ogłoszenia BZP" value={String(stats?.notices ?? 0)} icon={FileSearchIcon} hint={`umowy: ${stats?.contracts ?? 0}`} />
        <StatCard label="Zdarzenia do weryfikacji" value={String(stats?.proposed ?? 0)} icon={DatabaseIcon} hint={`zatwierdzone: ${stats?.accepted ?? 0}`} />
        <StatCard label="Koszt AI łącznie" value={usd(stats?.costUsd ?? 0)} icon={BotIcon} hint={`${stats?.runs ?? 0} wywołań`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheckIcon className="size-4" aria-hidden /> Oceń nową inwestycję
          </CardTitle>
          <CardDescription>
            Opisz plan albo wgraj dokument — Risk Miner dobierze podobne zakończone inwestycje, pokaże odchylenia kosztu i terminu, ryzyka oraz
            to, co sprawdzić przed przetargiem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/assessments/new">Nowa ocena inwestycji</Link>
          </Button>
        </CardContent>
      </Card>
      <ImportPanel {...importProps} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4" aria-hidden /> Jak powstaje rekord
          </CardTitle>
          <CardDescription>
            Model produkcyjny: <span className="font-mono">{model}</span> (zmiana w zmiennej LLM_MODEL, bez zmian w kodzie).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {i + 1}. {step.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
