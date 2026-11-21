import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/rm/action-button";
import { CatalogGuidanceDialog, type GuidancePatch } from "@/components/rm/catalog-guidance-dialog";
import type { MatchActions, MatchDialogProject } from "@/components/rm/match-dialog";
import { MatchRow } from "@/components/rm/match-row";
import { Provenance } from "@/components/rm/provenance";
import { RiskEventCard, type RiskEventActions } from "@/components/rm/risk-event-card";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/rm/format";
import type { CatalogEntry, Decision, Procurement, RiskEvent, Source } from "@/lib/rm/types";

export type ReviewData = {
  events: (RiskEvent & { project_title: string })[];
  procurements: (Procurement & { project_title: string; project?: MatchDialogProject; notice_url?: string | null; published_at?: string | null })[];
  catalog: CatalogEntry[];
  decisions: Decision[];
  sources: Record<string, Source>;
};

type Props = {
  data: ReviewData;
  eventActions?: RiskEventActions;
  decideProcurement?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  assignProcurement?: MatchActions["assign"];
  decideCatalog?: (code: string, approved: boolean) => Promise<ActionResult>;
  editGuidance?: (code: string, patch: GuidancePatch) => Promise<ActionResult>;
};

const actionLabel: Record<string, string> = {
  accept: "zatwierdził",
  reject: "odrzucił",
  reopen: "przywrócił",
  edit: "poprawił i zatwierdził",
  exemplary: "oznaczył jako wzorcowe",
  not_exemplary: "usunął oznaczenie wzorcowe",
  edit_guidance: "zmienił zalecenia kategorii",
  edit_params: "zmienił założenia oceny",
  delete: "usunął",
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
export function ReviewView({ data, eventActions, decideProcurement, assignProcurement, decideCatalog, editGuidance }: Props) {
  const approvedCatalog = data.catalog.filter((c) => c.approved);
  const proposedCatalog = data.catalog.filter((c) => !c.approved);

  return (
    <>
      <PageHeader title="Weryfikacja" description="Niepewne propozycje są na górze (sortowanie po pewności). Zatwierdzone przykłady wzorcowe trafiają do kolejnych analiz modelu." />
      <Tabs defaultValue="events">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="events">Zdarzenia ({data.events.length})</TabsTrigger>
          <TabsTrigger value="matches">Dopasowania ({data.procurements.length})</TabsTrigger>
          <TabsTrigger value="catalog">
            Katalog ({data.catalog.length}){proposedCatalog.length > 0 && ` · ${proposedCatalog.length} do zatwierdzenia`}
          </TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          {data.events.length === 0 ? (
            <NothingHere text="Brak zdarzeń do weryfikacji. Wzbogać projekty lub uruchom analizę AI." />
          ) : (
            <div className="flex flex-col gap-4">
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
            <NothingHere text="Wszystkie dopasowania projektów do przetargów w BZP są rozstrzygnięte." />
          ) : (
            <>
              <p className="pb-2 text-sm text-muted-foreground">Czy projekt z pliku to na pewno ten przetarg w BZP? Najmniej pewne na górze.</p>
              <ul className="flex flex-col">
                {data.procurements.map((p) => (
                  <MatchRow key={p.id} match={p} decide={decideProcurement} assign={assignProcurement} />
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Katalog jest otwarty: model może zaproponować nową kategorię, ekspert ją zatwierdza. Słowa kluczowe kategorii zasilają reguły, a zalecenia (co sprawdzić, działania, zapisy umowne) — ocenę nowych inwestycji. Bez zmian w kodzie.
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
                    <TableCell className="text-right whitespace-nowrap">
                      {editGuidance && <CatalogGuidanceDialog entry={c} save={editGuidance} />}
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
