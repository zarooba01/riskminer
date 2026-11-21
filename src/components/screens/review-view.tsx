import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/rm/action-button";
import { Confidence, Provenance } from "@/components/rm/provenance";
import { RiskEventCard, type RiskEventActions } from "@/components/rm/risk-event-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, Decision, Procurement, RiskEvent, Source } from "@/lib/rm/types";

export type ReviewData = {
  events: (RiskEvent & { project_title: string })[];
  procurements: (Procurement & { project_title: string })[];
  catalog: CatalogEntry[];
  decisions: Decision[];
  sources: Record<string, Source>;
};

type Props = {
  data: ReviewData;
  eventActions?: RiskEventActions;
  decideProcurement?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  decideCatalog?: (code: string, approved: boolean) => Promise<ActionResult>;
};

const actionLabel: Record<string, string> = {
  accept: "zatwierdził",
  reject: "odrzucił",
  reopen: "przywrócił",
  edit: "poprawił i zatwierdził",
  exemplary: "oznaczył jako wzorcowe",
  not_exemplary: "usunął oznaczenie wzorcowe",
};

function NothingHere({ text }: { text: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Kolejka pusta</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Panel eksperta: każda propozycja (dopasowanie, zdarzenie, kategoria) wymaga decyzji; wszystko trafia do historii. */
export function ReviewView({ data, eventActions, decideProcurement, decideCatalog }: Props) {
  const approvedCatalog = data.catalog.filter((c) => c.approved);
  const proposedCatalog = data.catalog.filter((c) => !c.approved);

  return (
    <>
      <PageHeader title="Weryfikacja" description="Niepewne propozycje są na górze (sortowanie po pewności). Zatwierdzone przykłady wzorcowe trafiają do kolejnych analiz modelu." />
      <Tabs defaultValue="events">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="events">Zdarzenia ({data.events.length})</TabsTrigger>
          <TabsTrigger value="matches">Dopasowania ({data.procurements.length})</TabsTrigger>
          <TabsTrigger value="catalog">Katalog ({proposedCatalog.length})</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          {data.events.length === 0 ? (
            <NothingHere text="Brak zdarzeń do weryfikacji. Wzbogać projekty lub uruchom analizę AI." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.events.map((e) => (
                <RiskEventCard
                  key={e.id}
                  event={e}
                  source={e.source_id ? data.sources[e.source_id] : null}
                  catalog={approvedCatalog}
                  actions={eventActions}
                  projectLabel={`${e.project_id} ${e.project_title.slice(0, 60)}`}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="matches">
          {data.procurements.length === 0 ? (
            <NothingHere text="Wszystkie dopasowania projektów do postępowań BZP są rozstrzygnięte." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.procurements.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Confidence value={p.match_confidence} />
                      <Badge variant="outline">{p.match_method === "notice_number" ? "po numerze BZP" : "wyszukiwanie"}</Badge>
                    </div>
                    <CardTitle className="text-base">
                      <Link href={`/projects/${p.project_id}`} className="hover:underline">
                        {p.project_id}: {p.project_title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      ↔ {p.bzp_number}: {p.title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-inside list-disc text-sm">
                      {p.match_basis.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </CardContent>
                  {decideProcurement && (
                    <CardFooter className="gap-2">
                      <ActionButton size="sm" action={decideProcurement.bind(null, p.id, "accept")}>
                        Potwierdź
                      </ActionButton>
                      <ActionButton size="sm" variant="ghost" action={decideProcurement.bind(null, p.id, "reject")}>
                        Odrzuć
                      </ActionButton>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Katalog jest otwarty: model może zaproponować nową kategorię, ekspert ją zatwierdza. Słowa kluczowe kategorii zasilają reguły — bez zmian w kodzie.
          </p>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Pochodzenie</TableHead>
                  <TableHead className="text-right">Decyzja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...proposedCatalog, ...approvedCatalog].map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="max-w-lg whitespace-normal">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.effects}</p>
                    </TableCell>
                    <TableCell>
                      <Provenance kind={c.proposed_by === "llm" ? "llm" : "expert"} />
                    </TableCell>
                    <TableCell className="text-right">
                      {decideCatalog &&
                        (c.approved ? (
                          <ActionButton size="sm" variant="ghost" action={decideCatalog.bind(null, c.code, false)}>
                            Wyłącz
                          </ActionButton>
                        ) : (
                          <ActionButton size="sm" action={decideCatalog.bind(null, c.code, true)}>
                            Zatwierdź
                          </ActionButton>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {data.decisions.length === 0 ? (
            <NothingHere text="Jeszcze nie podjęto żadnych decyzji." />
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {data.decisions.map((d) => (
                <li key={d.id} className="flex flex-col gap-0.5 p-3 text-sm">
                  <span>
                    <span className="font-medium">{d.actor}</span> {actionLabel[d.action] ?? d.action} · {d.entity} <span className="font-mono text-xs">{d.entity_id.slice(0, 8)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {d.created_at.slice(0, 16).replace("T", " ")}
                    {d.comment ? ` · „${d.comment}”` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
