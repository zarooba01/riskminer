import { Button, Card, Chip } from "@heroui/react";
import { PlusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import type { RecordStatus, SampleRecord } from "@sample-data";

export const statusChip: Record<RecordStatus, { color: "accent" | "warning" | "default"; variant: "primary" | "soft" | "secondary" }> = {
  nowe: { color: "accent", variant: "primary" },
  "w toku": { color: "warning", variant: "soft" },
  zamknięte: { color: "default", variant: "secondary" },
};

function Stat({ label, value, change, down }: { label: string; value: string; change?: string; down?: boolean }) {
  return (
    <Card>
      <Card.Content className="gap-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {change && (
          <p className={`flex items-center gap-1 text-xs font-medium ${down ? "text-danger" : "text-success"}`}>
            {down ? <TrendingDownIcon className="size-3" aria-hidden /> : <TrendingUpIcon className="size-3" aria-hidden />}
            {change} m/m
          </p>
        )}
      </Card.Content>
    </Card>
  );
}

export function DashboardScreen({ userName, records }: { userName: string; records: SampleRecord[] }) {
  const open = records.filter((record) => record.status !== "zamknięte").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dzień dobry, {userName}</h1>
          <p className="mt-1 text-sm text-muted">Podsumowanie tego, co dzieje się w aplikacji.</p>
        </div>
        <Button variant="primary">
          <PlusIcon className="size-4" /> Nowy rekord
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Wszystkie" value={String(records.length)} change="+12%" />
        <Stat label="Otwarte" value={String(open)} />
        <Stat label="Zamknięte" value={String(records.length - open)} />
        <Stat label="Użytkownicy" value="128" change="-3%" down />
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Ostatnia aktywność</Card.Title>
          <Card.Description>Najnowsze rekordy w systemie.</Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="divide-y divide-separator">
            {records.slice(0, 5).map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{record.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {record.id} · {record.owner}
                  </span>
                </span>
                <Chip size="sm" {...statusChip[record.status]}>
                  {record.status}
                </Chip>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
