import { AlertTriangleIcon, BotIcon, DatabaseIcon, FileDownIcon, FileSearchIcon, FolderKanbanIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { HowItWorksDialog } from "@/components/rm/how-it-works-dialog";
import { QueueFlowCard, type QueueFlowPoint } from "@/components/rm/queue-flow-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usd } from "@/lib/rm/format";

export type DashboardStatsView = {
  projects: number;
  enriched: number;
  proposed: number;
  accepted: number;
  runs: number;
  costUsd: number;
  /** Unikalne projekty z co najmniej jedną propozycją dopasowania czekającą na decyzję eksperta. */
  matchProjects: number;
};

export type QueueFlowView = { days: QueueFlowPoint[]; historyFrom: string | null };

type Props = {
  stats: DashboardStatsView | null;
  flow: QueueFlowView | null;
  model: string;
  configError?: string;
};

export function DashboardView({ stats, flow, model, configError }: Props) {
  return (
    <>
      <PageHeader
        title="Risk Miner"
        description="Baza doświadczeń inwestycji wodno-kanalizacyjnych: od rozproszonych ogłoszeń do zweryfikowanych zdarzeń ryzyka."
        actions={
          <>
            <HowItWorksDialog model={model} />
            <Button variant="outline" asChild>
              <Link href="/export">
                <FileDownIcon aria-hidden /> Eksport danych
              </Link>
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
        <StatCard
          label="Projekty"
          value={String(stats?.projects ?? 0)}
          icon={FolderKanbanIcon}
          hint={`wzbogacone: ${stats?.enriched ?? 0}`}
          link={{ href: "/projects", label: "Zobacz projekty →" }}
        />
        <StatCard
          label="Projekty z dopasowaniem do sprawdzenia"
          value={String(stats?.matchProjects ?? 0)}
          icon={FileSearchIcon}
          hint="propozycje przetargów z BZP"
          link={{ href: "/review?tab=matches", label: "Sprawdź dopasowania →" }}
        />
        <StatCard
          label="Zdarzenia do weryfikacji"
          value={String(stats?.proposed ?? 0)}
          icon={DatabaseIcon}
          hint={`zatwierdzone: ${stats?.accepted ?? 0}`}
          link={{ href: "/review?tab=events", label: "Sprawdź zdarzenia →" }}
        />
        <StatCard
          label="Koszt AI łącznie"
          value={usd(stats?.costUsd ?? 0)}
          icon={BotIcon}
          hint={`${stats?.runs ?? 0} wywołań`}
          link={{ href: "/llm", label: "Zobacz modele →" }}
        />
      </div>
      <QueueFlowCard days={flow?.days ?? []} historyFrom={flow?.historyFrom ?? null} />
    </>
  );
}
