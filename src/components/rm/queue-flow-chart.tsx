"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type QueueFlowPoint = { date: string; created: number | null; resolved: number | null };

const config = {
  created: { label: "Nowe sprawy", color: "var(--primary)" },
  resolved: { label: "Rozpatrzone sprawy", color: "var(--success)" },
} satisfies ChartConfig;

const ranges = [
  { value: "week", label: "Ten tydzień" },
  { value: "7d", label: "Ostatnie 7 dni" },
  { value: "month", label: "Ten miesiąc" },
  { value: "30d", label: "Ostatnie 30 dni" },
] as const;
type Range = (typeof ranges)[number]["value"];

// Daty to dni kalendarzowe (YYYY-MM-DD) — formatujemy w UTC, żeby strefa przeglądarki nie przesunęła dnia.
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const fmt = (day: string, options: Intl.DateTimeFormatOptions) => asDate(day).toLocaleDateString("pl-PL", { ...options, timeZone: "UTC" });
const shortDate = (day: string) => fmt(day, { day: "numeric", month: "numeric" });
const longDate = (day: string) => fmt(day, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
/** „22 listopada 2026”, „16–22 listopada 2026” albo „24 października – 22 listopada 2026”. */
function periodLabel(from: string, to: string) {
  const end = fmt(to, { day: "numeric", month: "long", year: "numeric" });
  if (from === to) return end;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${end}`;
  return `${fmt(from, { day: "numeric", month: "long" })} – ${end}`;
}

/** Dni z wybranego zakresu; ostatni element `days` to dzisiaj. Tydzień liczymy od poniedziałku. */
function pick(days: QueueFlowPoint[], range: Range) {
  const today = days.at(-1)?.date;
  if (!today) return [];
  switch (range) {
    case "week":
      return days.slice(-((asDate(today).getUTCDay() + 6) % 7) - 1);
    case "7d":
      return days.slice(-7);
    case "month":
      return days.filter((d) => d.date.slice(0, 7) === today.slice(0, 7));
    case "30d":
      return days.slice(-30);
  }
}

/** Karta z dziennym wykresem napływu i rozpatrywania spraw w kolejce weryfikacji; dni bez historii (null) nie są rysowane. */
export function QueueFlowCard({ days, historyFrom }: { days: QueueFlowPoint[]; historyFrom: string | null }) {
  const [range, setRange] = useState<Range>("30d");
  const visible = pick(days, range);
  const from = visible[0]?.date;
  const to = visible.at(-1)?.date;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Napływ i rozpatrywanie spraw</CardTitle>
        <CardDescription>
          {from && to ? `${periodLabel(from, to)} · ` : ""}dzienna liczba spraw w kolejce weryfikacji (dopasowania i zdarzenia): nowe — wg dnia
          dodania do kolejki, rozpatrzone — wg dnia decyzji eksperta (zatwierdzenie lub odrzucenie).
        </CardDescription>
        <CardAction>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList aria-label="Zakres danych">
              {ranges.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!historyFrom || !from ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Brak danych do wykresu</EmptyTitle>
              <EmptyDescription>
                W bazie nie ma jeszcze historii kolejki weryfikacji. Wykres pojawi się, gdy do kolejki trafią propozycje dopasowań lub zdarzeń albo
                ekspert podejmie pierwszą decyzję.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            <ChartContainer config={config} className="aspect-auto h-64 w-full">
              {/* Nowy klucz przy zmianie zakresu: wykres rysuje się od zera zamiast przesuwać punkty ze starego zakresu
                  (animacja przejścia w Recharts gubi wtedy długość linii i nie dociąga jej do ostatniego punktu). */}
              <LineChart key={range} data={visible} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" labelFormatter={(_, payload) => (payload?.[0] ? longDate(String(payload[0].payload.date)) : "")} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="created" type="linear" stroke="var(--color-created)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} animationDuration={500} animationEasing="ease-out" />
                <Line dataKey="resolved" type="linear" stroke="var(--color-resolved)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} animationDuration={500} animationEasing="ease-out" />
              </LineChart>
            </ChartContainer>
            {historyFrom > from && (
              <p className="text-xs text-muted-foreground">Historia kolejki jest dostępna od {longDate(historyFrom)} — wcześniejsze dni pominięto.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
