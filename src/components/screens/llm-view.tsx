import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usd, type ActionResult } from "@/lib/rm/format";

import { CompareForm } from "./compare-form";

export type ModelMetric = {
  model: string;
  region: string;
  createdAt: string;
  validSchema: boolean;
  error: string | null;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  costSource: string | null;
  events: number;
  codes: string[];
  quotesVerified: number;
  precision: number | null;
  recall: number | null;
  output: { events?: { risk_code: string; title: string; quote: string }[]; data_gaps?: string[] } | null;
};

type Props = {
  projects: { id: string; title: string }[];
  selectedProject: string | null;
  models: { id: string; region: string; price: string }[];
  metrics: ModelMetric[];
  goldCodes: string[];
  productionModel: string;
  compare: (projectId: string, models: string[]) => Promise<ActionResult>;
};

const share = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Kalkulacja kosztu jednego nowego przetargu (szacunek z planu, ceny AI Gateway 11.2026). */
const costTable = [
  { model: "alibaba/qwen3.7-flash", pipeline: 0.003, naive: 0.04 },
  { model: "openai/gpt-5-nano", pipeline: 0.007, naive: 0.07 },
  { model: "deepseek/deepseek-v4-flash", pipeline: 0.01, naive: 0.16 },
  { model: "anthropic/claude-haiku-5.5", pipeline: 0.011, naive: 0.13 },
  { model: "mistral/ministral-14b", pipeline: 0.014, naive: 0.24 },
  { model: "google/gemini-3.1-flash-lite", pipeline: 0.03, naive: 0.33 },
  { model: "anthropic/claude-sonnet-5.5", pipeline: 0.217, naive: 2.63 },
];

export function LlmView({ projects, selectedProject, models, metrics, goldCodes, productionModel, compare }: Props) {
  return (
    <>
      <PageHeader
        title="Porównanie modeli"
        description={`Ten sam wsad, różne modele: koszt, czas, poprawność struktury i zgodność z decyzjami eksperta. Model produkcyjny: ${productionModel}.`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uruchom porównanie</CardTitle>
            <CardDescription>Połączenie przez Vercel AI Gateway — jeden klucz, model wskazany identyfikatorem „dostawca/model”.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompareForm projects={projects} selectedProject={selectedProject} models={models} compare={compare} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ile kosztuje analiza jednego nowego przetargu</CardTitle>
            <CardDescription>
              Szacunek dla paczki ~80 tys. tokenów (ogłoszenie, SWZ, PPU, OPZ). Pipeline: najpierw reguły i statystyka (0 zł), LLM tylko na ~25% tekstu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="text-right">Naiwnie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costTable.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell className="text-right tabular-nums">${row.pipeline.toFixed(3)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">${row.naive.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Rekomendacja: hybryda — ekstrakcja na najtańszym modelu, który przejdzie test jakości, synteza po polsku na Haiku / GPT-luna ≈ 0,005–0,008 USD na przetarg.
            </p>
          </CardContent>
        </Card>
      </div>

      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wyniki dla {selectedProject}</CardTitle>
            <CardDescription>
              Złoty zbiór = kody ryzyk zatwierdzone przez eksperta:{" "}
              {goldCodes.length ? goldCodes.join(", ") : "brak — zatwierdź zdarzenia w Weryfikacji, aby policzyć precyzję i czułość"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {metrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak przebiegów dla tego projektu.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Koszt</TableHead>
                        <TableHead className="text-right">Czas</TableHead>
                        <TableHead className="text-right">Tokeny we/wy</TableHead>
                        <TableHead>Schemat</TableHead>
                        <TableHead className="text-right">Zdarzenia</TableHead>
                        <TableHead className="text-right">Cytaty OK</TableHead>
                        <TableHead className="text-right">Precyzja</TableHead>
                        <TableHead className="text-right">Czułość</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.map((m) => (
                        <TableRow key={m.model}>
                          <TableCell>
                            <span className="font-mono text-xs">{m.model}</span>
                            <p className="text-xs text-muted-foreground">{m.region}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {usd(m.costUsd)}
                            {m.costSource === "pricing" && <p className="text-muted-foreground">z cennika</p>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{m.latencyMs != null ? `${(m.latencyMs / 1000).toFixed(1)} s` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {m.tokensIn ?? "—"} / {m.tokensOut ?? "—"}
                          </TableCell>
                          <TableCell>{m.validSchema ? <Badge variant="outline">poprawny</Badge> : <Badge variant="destructive">błąd</Badge>}</TableCell>
                          <TableCell className="text-right">{m.events}</TableCell>
                          <TableCell className="text-right">{share(m.quotesVerified)}</TableCell>
                          <TableCell className="text-right">{share(m.precision)}</TableCell>
                          <TableCell className="text-right">{share(m.recall)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Accordion type="multiple">
                  {metrics.map((m) => (
                    <AccordionItem key={m.model} value={m.model}>
                      <AccordionTrigger>
                        <span className="font-mono text-xs">{m.model}</span> — {m.codes.join(", ") || (m.error ? "błąd" : "brak zdarzeń")}
                      </AccordionTrigger>
                      <AccordionContent>
                        {m.error && <p className="text-sm text-destructive">{m.error}</p>}
                        <ul className="flex flex-col gap-2">
                          {m.output?.events?.map((e, i) => (
                            <li key={i} className="rounded-lg border p-2 text-sm">
                              <Badge variant="outline" className="mr-2 font-mono">
                                {e.risk_code}
                              </Badge>
                              {e.title}
                              <p className="mt-1 text-xs italic text-muted-foreground">„{e.quote}”</p>
                            </li>
                          ))}
                        </ul>
                        {!!m.output?.data_gaps?.length && (
                          <p className="mt-2 text-xs text-muted-foreground">Braki danych wskazane przez model: {m.output.data_gaps.join("; ")}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
