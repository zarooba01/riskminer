import { BotIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/rm/action-button";
import { Confidence, Provenance, StatusBadge } from "@/components/rm/provenance";
import { RiskEventCard, type RiskEventActions } from "@/components/rm/risk-event-card";
import { SourceLink } from "@/components/rm/source-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { date, days, pct, pln, type ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, Contract, ContractChange, Notice, Procurement, Project, RiskEvent, Source } from "@/lib/rm/types";

export type ProjectDetailData = {
  project: Project;
  procurements: (Procurement & { notices: Notice[]; contracts: Contract[]; changes: ContractChange[] })[];
  events: RiskEvent[];
  sources: Record<string, Source>;
};

type Props = {
  data: ProjectDetailData;
  catalog: CatalogEntry[];
  model: string;
  enrich?: () => Promise<ActionResult>;
  analyze?: () => Promise<ActionResult>;
  eventActions?: RiskEventActions;
  decideProcurement?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
};

const noticeLabel: Record<string, string> = {
  ContractNotice: "Ogłoszenie o zamówieniu",
  TenderResultNotice: "Wynik postępowania",
  AgreementUpdateNotice: "Zmiana umowy",
  ContractPerformingNotice: "Wykonanie umowy",
};

function Fact({ label, value, kind, source }: { label: string; value: React.ReactNode; kind: "source" | "calc"; source?: Source }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Provenance kind={kind} />
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {source && <SourceLink source={source} />}
    </div>
  );
}

function ContractCard({ contract, changes, notices, sources }: { contract: Contract; changes: ContractChange[]; notices: Notice[]; sources: Record<string, Source> }) {
  const src = (type: string) => {
    const n = notices.find((x) => x.notice_type === type);
    return n ? sources[n.source_id] : undefined;
  };
  const result = src("TenderResultNotice");
  const performing = src("ContractPerformingNotice");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label="Wartość umowy (brutto)" value={pln(contract.initial_value)} kind="source" source={result ?? performing} />
        <Fact label="Wypłacono łącznie" value={pln(contract.paid_total)} kind="source" source={performing} />
        <Fact label="Odchylenie kosztu" value={pct(contract.cost_deviation_pct)} kind="calc" />
        <Fact label="Opóźnienie" value={days(contract.delay_days)} kind="calc" />
        <Fact label="Zawarcie umowy" value={date(contract.signed_at)} kind="source" source={result} />
        <Fact label="Planowany koniec" value={`${date(contract.planned_end)} (${contract.initial_months ?? "?"} mies.)`} kind="calc" />
        <Fact label="Faktyczne wykonanie" value={date(contract.actual_end)} kind="source" source={performing} />
        <Fact
          label="Oferty (min / max)"
          value={contract.offers_count != null ? `${contract.offers_count} · ${pln(contract.lowest_offer)} / ${pln(contract.highest_offer)}` : "—"}
          kind="source"
          source={result}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Wykonawca: <span className="text-foreground">{contract.contractor_name ?? "—"}</span>
        {contract.contractor_nip ? ` (NIP ${contract.contractor_nip})` : ""}. Należyte wykonanie:{" "}
        {contract.performed_properly == null ? "brak danych" : contract.performed_properly ? "tak" : "nie"}.
      </p>
      {changes.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr</TableHead>
                <TableHead>Podstawa</TableHead>
                <TableHead>Przyczyna</TableHead>
                <TableHead className="text-right">Wartość</TableHead>
                <TableHead>Źródło</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.change_no ?? "—"}</TableCell>
                  <TableCell className="text-xs">{c.legal_basis ?? "—"}</TableCell>
                  <TableCell className="max-w-md whitespace-normal text-xs">
                    {c.reason}
                    {c.description && c.description !== c.reason && <p className="mt-1 text-muted-foreground">{c.description.slice(0, 300)}</p>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{pln(c.value_change)}</TableCell>
                  <TableCell>
                    <SourceLink source={sources[c.source_id]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function ProjectDetailView({ data, catalog, model, enrich, analyze, eventActions, decideProcurement }: Props) {
  const { project, procurements, events, sources } = data;
  const proposed = events.filter((e) => e.status === "proposed").length;
  const projectSource = project.source_id;
  const scopePart = Number(project.record_scope?.match(/część\s*(\d+)/i)?.[1] ?? 0);

  return (
    <>
      <PageHeader
        title={project.title}
        description={`${project.id} · ${project.beneficiary_name} (NIP ${project.beneficiary_nip ?? "—"}) · ${project.province ?? ""}`}
        actions={
          <>
            {enrich && (
              <ActionButton action={enrich} variant="outline" pendingLabel="Pobieram z BZP…">
                <RefreshCwIcon /> {project.enriched_at ? "Odśwież z BZP" : "Wzbogać z BZP"}
              </ActionButton>
            )}
            {analyze && (
              <ActionButton action={analyze} pendingLabel="Model analizuje…" disabled={!procurements.length}>
                <BotIcon /> Analizuj ryzyka (AI)
              </ActionButton>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {project.subsector_main && <Badge>{project.subsector_main}</Badge>}
        {project.subsectors_extra.map((s) => (
          <Badge key={s} variant="secondary">
            + {s}
          </Badge>
        ))}
        {project.works_type && <Badge variant="outline">{project.works_type}</Badge>}
        {project.record_scope && <Badge variant="outline">zakres rekordu: {project.record_scope}</Badge>}
        <Badge variant="outline">
          {project.public_id_type}: {project.public_id}
        </Badge>
        {projectSource && sources[projectSource] && <SourceLink source={sources[projectSource]} label="rekord z pliku" />}
      </div>
      {project.annotation && <p className="max-w-4xl text-sm text-muted-foreground">{project.annotation}</p>}

      <Tabs defaultValue="course">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="course">Przebieg</TabsTrigger>
          <TabsTrigger value="events">Zdarzenia ryzyka {proposed > 0 && `(${proposed})`}</TabsTrigger>
          <TabsTrigger value="log">Źródła i log</TabsTrigger>
        </TabsList>

        <TabsContent value="course" className="flex flex-col gap-4">
          {!project.enriched_at && (
            <Alert>
              <AlertTitle>Projekt nie był jeszcze wzbogacany</AlertTitle>
              <AlertDescription>Użyj „Wzbogać z BZP” — system wyszuka ogłoszenia i odtworzy przebieg umowy.</AlertDescription>
            </Alert>
          )}
          {project.enriched_at && !procurements.length && (
            <Alert variant="destructive">
              <AlertTitle>Nie znaleziono postępowania w BZP</AlertTitle>
              <AlertDescription>
                Brak dopasowania nie oznacza braku postępowania (np. publikacja wyłącznie w TED lub na platformie zamawiającego). Szczegóły zapytań w zakładce „Źródła i log”.
              </AlertDescription>
            </Alert>
          )}
          {procurements.map((proc) => (
            <Card key={proc.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={proc.status} />
                  <Confidence value={proc.match_confidence} />
                  <Badge variant="outline">{proc.match_method === "notice_number" ? "dopasowanie po numerze BZP" : "dopasowanie wyszukiwaniem"}</Badge>
                </div>
                <CardTitle className="text-base">{proc.title}</CardTitle>
                <CardDescription className="break-all font-mono text-xs">
                  {proc.bzp_number} · {proc.ocid}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Podstawa dopasowania</p>
                  <ul className="list-inside list-disc text-sm">
                    {proc.match_basis.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  {decideProcurement && proc.status !== "accepted" && (
                    <div className="mt-2 flex gap-2">
                      <ActionButton size="sm" action={decideProcurement.bind(null, proc.id, "accept")}>
                        Potwierdź dopasowanie
                      </ActionButton>
                      {proc.status !== "rejected" && (
                        <ActionButton size="sm" variant="ghost" action={decideProcurement.bind(null, proc.id, "reject")}>
                          Odrzuć
                        </ActionButton>
                      )}
                    </div>
                  )}
                </div>
                <ol className="relative flex flex-col gap-3 border-l pl-4">
                  {proc.notices.map((n) => (
                    <li key={n.id} className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{date(n.published_at)}</span>
                      <span className="text-sm font-medium">{noticeLabel[n.notice_type] ?? n.notice_type}</span>
                      <SourceLink source={sources[n.source_id]} label={n.notice_number} />
                    </li>
                  ))}
                </ol>
                {proc.contracts.length ? (
                  proc.contracts.map((contract) => (
                    <div key={contract.id} className="flex flex-col gap-2">
                      {(proc.contracts.length > 1 || contract.part_no > 0) && (
                        <h3 className="text-sm font-semibold">
                          {contract.part_no > 0 && contract.part_no < 100 ? `Część ${contract.part_no}` : "Umowa"}
                          {contract.part_title ? `: ${contract.part_title}` : ""}
                          {scopePart === contract.part_no && <Badge className="ml-2">zakres rekordu</Badge>}
                        </h3>
                      )}
                      <ContractCard
                        contract={contract}
                        changes={proc.changes.filter((c) => c.contract_id === contract.id)}
                        notices={proc.notices.filter((n) => contract.source_ids.includes(n.source_id))}
                        sources={sources}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Brak ogłoszenia o wyniku i o wykonaniu umowy — umowy nie odtworzono.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="events" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Propozycje z reguł (bez AI) i z modelu <span className="font-mono">{model}</span>. Każde zdarzenie wymaga decyzji eksperta.
          </p>
          {events.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Brak zdarzeń</EmptyTitle>
                <EmptyDescription>Wzbogać projekt z BZP, a potem uruchom analizę ryzyk.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {events.map((e) => (
                <RiskEventCard key={e.id} event={e} source={e.source_id ? sources[e.source_id] : null} catalog={catalog} actions={eventActions} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zapytania do źródeł publicznych</CardTitle>
              <CardDescription>Ostatnie wzbogacenie: {project.enriched_at ? project.enriched_at.slice(0, 16).replace("T", " ") : "—"}. Proces można powtórzyć bez ręcznego wpisywania wyników.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {project.enrichment_log.map((entry, i) => (
                  <li key={i} className="flex flex-col gap-0.5 border-b pb-2 last:border-0">
                    <span className="font-medium">
                      {entry.step}
                      {entry.count != null && <Badge variant="outline" className="ml-2">{entry.count}</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.detail}</span>
                    {entry.url && (
                      <a href={entry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline">
                        {entry.url} <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
