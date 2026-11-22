import { ChevronDownIcon, FileSearchIcon } from "lucide-react";
import Link from "next/link";

import { ActionButton } from "@/components/rm/action-button";
import { ChangeReportCard } from "@/components/rm/change-report-card";
import { ExternalSources } from "@/components/rm/external-sources";
import { PlanVsActual } from "@/components/rm/plan-vs-actual";
import { MatchDialog, type MatchActions } from "@/components/rm/match-dialog";
import { DocumentsTab } from "@/components/rm/documents-tab";
import { NoticeTimelineItem } from "@/components/rm/notice-timeline-item";
import { ProjectActionsMenu } from "@/components/rm/project-actions-menu";
import { RiskEventRow, type RiskEventActions } from "@/components/rm/risk-event-row";
import { SourceLink } from "@/components/rm/source-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { scopePartOf, summarizeContracts } from "@/lib/rm/contracts";
import { date, days, pct, pln, plnShort, type ActionResult } from "@/lib/rm/format";
import { summarizeNotice } from "@/lib/rm/notice-summary";
import { sourceViewHref } from "@/lib/rm/highlight";
import type { CatalogEntry, ChangeReport, Contract, ContractChange, DocumentFinding, ExternalCheck, MatchInfo, Notice, Procurement, Project, ProjectDocument, RiskEvent, Source } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

export type ProjectDetailData = {
  documents?: (ProjectDocument & { findings: DocumentFinding[] })[];
  externalChecks?: ExternalCheck[];
  changeReports?: ChangeReport[];
  project: Project;
  procurements: (Procurement & { notices: Notice[]; contracts: Contract[]; changes: ContractChange[] })[];
  events: RiskEvent[];
  sources: Record<string, Source>;
};

type Props = {
  data: ProjectDetailData;
  catalog: CatalogEntry[];
  model?: string;
  enrich?: () => Promise<ActionResult>;
  analyze?: () => Promise<ActionResult>;
  eventActions?: RiskEventActions;
  decideProcurement?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  assignProcurement?: MatchActions["assign"];
  decideFinding?: (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;
  /** Wybrane zamówienie, gdy inwestycja ma kilka zatwierdzonych zamówień (parametr ?zamowienie=). */
  selectedProcurementId?: string | null;
};

const noticeLabel: Record<string, string> = {
  ContractNotice: "Ogłoszenie o zamówieniu",
  TenderResultNotice: "Wynik postępowania",
  AgreementUpdateNotice: "Zmiana umowy",
  ContractPerformingNotice: "Wykonanie umowy",
};

const statusOrder: Record<RiskEvent["status"], number> = { proposed: 0, accepted: 1, rejected: 2 };

/** Zmiana umowy jako pozycja osi: numer, krótka przyczyna i skutek (kwota albo nowy termin). */
function changeSubItem(ch: ContractChange, projectId: string) {
  const text = `${ch.reason ?? ""} ${ch.description ?? ""}`;
  const generic = /^(protokół|porozumienie|aneks)$/i.test((ch.reason ?? "").trim());
  const reason = (generic && ch.description ? ch.description : ch.reason ?? ch.description ?? "bez opisu").replace(/^["„\s]+|["”\s]+$/g, "").replace(/\s+/g, " ");
  const term = text.match(/termin\w*[^.]{0,40}?(\d+\s*m-c\w*(?:\s*i\s*\d+\s*dni)?|\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})/i)?.[1];
  const basis = ch.legal_basis?.replace(/\s*ustawy\s*$/, "").replace("art. 455 ", "") ?? "";
  return {
    key: ch.id,
    label: `Zmiana nr ${ch.change_no ?? "—"}`,
    detail: `${reason.length > 110 ? `${reason.slice(0, 110).replace(/\s\S*$/, "")}…` : reason}${basis ? ` (${basis})` : ""}`,
    effect: ch.value_change ? `+${pln(ch.value_change)}` : ch.new_end_date ? `nowy termin: ${ch.new_end_date}` : term ? `termin: ${term}` : null,
    href: sourceViewHref(ch.source_id, ch.reason ?? ch.description, projectId),
    warning: Boolean(ch.value_change) || /455 ust\. 1 pkt [34]/.test(ch.legal_basis ?? ""),
  };
}

/** Kafelek KPI: duża liczba, pochodzenie danych w podpowiedzi zamiast etykiet. */
function Kpi({ label, value, hint, alert }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex flex-col gap-1 rounded-xl border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={cn("text-xl font-semibold tabular-nums sm:text-2xl", alert && "text-destructive")}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Defs({ rows }: { rows: [string, React.ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "—");
  if (!visible.length) return <p className="text-sm text-muted-foreground">Brak danych.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[12rem_minmax(0,1fr)]">
      {visible.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProjectDetailView({ data, catalog, enrich, analyze, eventActions, decideProcurement, assignProcurement, decideFinding, selectedProcurementId }: Props) {
  const { project, procurements, events, sources } = data;
  // Inwestycja może mieć kilka zamówień (np. osobne przetargi na sieć i oczyszczalnię) — każde oglądamy osobno.
  const acceptedProcs = procurements.filter((p) => p.status === "accepted");
  const primary =
    acceptedProcs.find((p) => p.id === selectedProcurementId) ?? acceptedProcs[0] ?? procurements.find((p) => p.status !== "rejected") ?? null;
  const allRejected = procurements.length > 0 && !primary;
  const matchActions = decideProcurement && assignProcurement ? { decide: decideProcurement, assign: assignProcurement } : null;
  const contractNotice = primary?.notices.find((n) => n.notice_type === "ContractNotice");
  const matchInfo: MatchInfo | null = primary
    ? {
        id: primary.id,
        status: primary.status === "accepted" ? "accepted" : "proposed",
        bzp_number: primary.bzp_number,
        title: primary.title,
        buyer_name: primary.buyer_name,
        buyer_nip: primary.buyer_nip,
        cpv: primary.cpv,
        confidence: primary.match_confidence,
        method: primary.match_method,
        basis: primary.match_basis,
        notice_url: contractNotice ? (sources[contractNotice.source_id]?.url ?? null) : null,
        published_at: contractNotice?.published_at ?? null,
      }
    : null;
  const matchProject = { id: project.id, title: project.title, beneficiary_name: project.beneficiary_name, beneficiary_nip: project.beneficiary_nip, public_id_type: project.public_id_type, public_id: project.public_id };
  const withMatchDialog = (trigger: React.ReactElement) =>
    matchActions ? (
      <MatchDialog project={matchProject} match={matchInfo} actions={matchActions}>
        {trigger}
      </MatchDialog>
    ) : null;
  const scopePart = scopePartOf(project.record_scope);
  // Umowa, koszt i czas tylko z zatwierdzonego dopasowania.
  const contracts = primary?.status === "accepted" ? primary.contracts : [];
  const summary = summarizeContracts(project, contracts);
  const scoped = contracts.filter((c) => !scopePart || c.part_no === scopePart || !contracts.some((x) => x.part_no === scopePart));
  const single = scoped.length === 1 ? scoped[0] : null;

  const noticeOf = (type: string) => primary?.notices.find((n) => n.notice_type === type && (!single || single.source_ids.includes(n.source_id)));
  const resultNotice = noticeOf("TenderResultNotice");
  const performingNotice = noticeOf("ContractPerformingNotice");
  const fromNotice = (n?: Notice) => (n ? `Źródło: ogłoszenie ${n.notice_number}` : "Brak ogłoszenia w BZP");
  const multi = !single && scoped.length > 1 ? `Suma ${scoped.length} umów (części przetargu). ` : "";
  const pendingMatch = primary?.status === "proposed";
  const noData = (reason: string) => (pendingMatch ? "Potwierdź dopasowanie do przetargu, aby wyliczyć." : reason);

  const sortedEvents = [...events].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const documents = data.documents ?? [];
  const contractOptions = contracts.map((c) => ({
    id: c.id,
    label: `${c.part_no > 0 && c.part_no < 100 ? `Część ${c.part_no}` : "Umowa"} — ${c.contractor_name ?? "wykonawca ?"}${c.initial_value != null ? `, ${pln(c.initial_value)}` : ""}`,
  }));
  const proposed = events.filter((e) => e.status === "proposed").length;

  return (
    <>
      {/* Nagłówek */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <h1 className="line-clamp-2 text-xl font-semibold tracking-tight sm:text-2xl">{project.title}</h1>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">{project.title}</TooltipContent>
          </Tooltip>
          <p className="mt-1 text-sm text-muted-foreground">{[project.beneficiary_name, project.province, project.subsector_main].filter(Boolean).join(" · ")}</p>
        </div>
        <ProjectActionsMenu projectId={project.id} contracts={contractOptions} enrich={enrich} analyze={analyze} canAnalyze={primary?.status === "accepted"} />
      </div>

      {/* Baner tylko, gdy coś wymaga decyzji */}
      {!project.enriched_at && !procurements.length && !project.enrichment_log.length ? (
        <Alert className="flex flex-wrap items-center justify-between gap-2">
          <AlertDescription>Projekt nie ma jeszcze danych z BZP.</AlertDescription>
          {enrich && (
            <ActionButton size="sm" action={enrich} pendingLabel="Pobieram…">
              Wzbogać z BZP
            </ActionButton>
          )}
        </Alert>
      ) : !primary ? (
        <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-2">
          <AlertDescription>{allRejected ? "Dopasowanie odrzucone — wskaż właściwy przetarg." : "Nie znaleziono przetargu w BZP — wskaż go ręcznie."}</AlertDescription>
          {withMatchDialog(<Button size="sm">Wskaż przetarg</Button>)}
        </Alert>
      ) : primary.status === "proposed" ? (
        <Alert className="flex flex-wrap items-center justify-between gap-2 border-warning/50 bg-warning/10">
          <AlertDescription className="text-foreground">
            Przetarg do potwierdzenia: {primary.bzp_number}
          </AlertDescription>
          {withMatchDialog(<Button size="sm">Dopasuj</Button>)}
        </Alert>
      ) : null}

      {/* Kilka zamówień w jednej inwestycji */}
      {acceptedProcs.length > 1 && (
        <nav aria-label="Zamówienia inwestycji" className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Zamówienia tej inwestycji ({acceptedProcs.length}) — każde sprawdzisz osobno:</span>
          <div className="flex flex-wrap gap-2">
            {acceptedProcs.map((p) => (
              <Button key={p.id} asChild size="sm" variant={p.id === primary?.id ? "default" : "outline"}>
                <Link href={`/projects/${encodeURIComponent(project.id)}?zamowienie=${p.id}`} aria-current={p.id === primary?.id ? "page" : undefined} title={p.title ?? undefined}>
                  {p.bzp_number ?? "zamówienie"}
                </Link>
              </Button>
            ))}
          </div>
        </nav>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Umowa" value={plnShort(summary?.initial_value)} hint={summary?.initial_value != null ? `${multi}${pln(summary.initial_value)} brutto. ${single ? fromNotice(resultNotice ?? performingNotice) : ""}` : noData("Brak ogłoszenia o wyniku postępowania.")} />
        <Kpi label="Wypłacono" value={plnShort(summary?.paid_total)} hint={summary?.paid_total != null ? `${multi}${pln(summary.paid_total)} brutto. ${single ? fromNotice(performingNotice) : ""}` : noData("Brak ogłoszenia o wykonaniu umowy.")} />
        <Kpi
          label="Koszt"
          value={pct(summary?.cost_deviation_pct)}
          alert={(summary?.cost_deviation_pct ?? 0) > 10}
          hint={summary?.cost_deviation_pct != null ? "Obliczenie: (wypłacono − wartość umowy) / wartość umowy." : noData("Brak danych o wypłacie.")}
        />
        <Kpi
          label="Czas"
          value={days(summary?.delay_days)}
          alert={(summary?.delay_days ?? 0) > 60}
          hint={
            summary?.delay_days != null
              ? single
                ? `Obliczenie: wykonanie ${date(single.actual_end)} vs pierwotny termin ${date(single.planned_end)}.`
                : `${multi}Największe opóźnienie wśród części.`
              : noData("Brak daty wykonania umowy.")
          }
        />
      </div>

      {/* Plan i wykonanie obok siebie (osobno dla każdej części umowy) */}
      {contracts.length > 0 && primary && (
        <section className="flex flex-col gap-2" aria-label="Plan i wykonanie">
          <h2 className="text-sm font-semibold">Plan i wykonanie</h2>
          <PlanVsActual
            projectId={project.id}
            contracts={contracts}
            changes={primary.changes}
            notices={primary.notices}
            budget={(data.externalChecks ?? []).find((c) => c.source === "platform")?.details.budget ?? null}
            scopePart={scopePart}
          />
        </section>
      )}

      <Tabs defaultValue={proposed ? "risks" : "timeline"}>
        <TabsList>
          <TabsTrigger value="timeline">Przebieg</TabsTrigger>
          <TabsTrigger value="risks">Ryzyka{events.length ? ` ${events.length}` : ""}</TabsTrigger>
          <TabsTrigger value="documents">Dokumenty{documents.length ? ` ${documents.length}` : ""}</TabsTrigger>
          <TabsTrigger value="details">Szczegóły</TabsTrigger>
        </TabsList>

        {/* Przebieg */}
        <TabsContent value="timeline" className="pt-2">
          {primary?.notices.length || documents.length ? (
            <ol className="relative flex flex-col gap-1 border-l pl-4">
              {(primary?.notices ?? []).map((n) => (
                <NoticeTimelineItem
                  key={n.id}
                  date={date(n.published_at)}
                  label={noticeLabel[n.notice_type] ?? n.notice_type}
                  noticeNumber={n.notice_number}
                  source={sources[n.source_id]}
                  summary={summarizeNotice(n.notice_type, n.parsed)}
                  projectId={project.id}
                  subItems={
                    (n.notice_type === "ContractPerformingNotice" || n.notice_type === "AgreementUpdateNotice") && primary
                      ? primary.changes
                          .filter((ch) => ch.source_id === n.source_id || (ch.related_source_ids ?? []).includes(n.source_id))
                          .sort((x, y) => (x.change_no ?? 0) - (y.change_no ?? 0))
                          .map((ch) => changeSubItem(ch, project.id))
                      : undefined
                  }
                />
              ))}
              {documents.map((d) => (
                <NoticeTimelineItem
                  key={d.id}
                  date={date(d.created_at)}
                  label={`Dokument eksperta: ${d.doc_type}`}
                  noticeNumber={d.file_name}
                  source={d.source_id ? sources[d.source_id] : undefined}
                  summary={{
                    summary: d.summary ?? (d.status === "error" ? "Analiza nie powiodła się." : "Dokument dodany."),
                    tone: d.findings.some((f) => f.kind === "conflicts" && f.status !== "rejected") ? "warning" : "neutral",
                    blocks: [],
                  }}
                />
              ))}
            </ol>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Brak ogłoszeń</EmptyTitle>
                <EmptyDescription>Wzbogać projekt z BZP.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {primary && (
            <section className="mt-6 flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Sprawdzone źródła</h3>
              <ExternalSources projectId={project.id} bzpNotices={primary.notices.length} checks={data.externalChecks ?? []} />
            </section>
          )}
        </TabsContent>

        {/* Ryzyka */}
        <TabsContent value="risks" className="flex flex-col gap-4 pt-2">
          <ChangeReportCard reports={data.changeReports ?? []} />
          {sortedEvents.length ? (
            <div className="flex flex-col gap-6">
              {(
                [
                  ["llm", "Analiza AI", "Model czyta ogłoszenia i opisuje przyczynę, skutek i działanie zaradcze."],
                  ["expert", "Dodane przez eksperta", ""],
                  ["rule", "Reguły", "Fakty wyliczone z ogłoszeń BZP (opóźnienie, koszt, zmiany umowy)."],
                ] as const
              ).map(([origin, title, hint]) => {
                const group = sortedEvents.filter((e) => e.origin === origin);
                if (!group.length) return null;
                return (
                  <section key={origin} className="flex flex-col">
                    <h3 className="flex items-baseline gap-2 text-sm font-semibold">
                      {title} <span className="font-normal text-muted-foreground">{group.length}</span>
                    </h3>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                    <ul className="mt-1 flex flex-col">
                      {group.map((e) => (
                        <RiskEventRow key={e.id} event={e} source={e.source_id ? sources[e.source_id] : null} catalog={catalog} actions={eventActions} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Brak zdarzeń</EmptyTitle>
                <EmptyDescription>Pojawią się po wzbogaceniu lub analizie AI.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>

        {/* Dokumenty eksperta */}
        <TabsContent value="documents" className="pt-2">
          <DocumentsTab projectId={project.id} contracts={contractOptions} documents={documents} decide={decideFinding} />
        </TabsContent>

        {/* Szczegóły */}
        <TabsContent value="details" className="flex flex-col gap-6 pt-2">
          {contracts.map((c) => (
            <Section key={c.id} title={contracts.length > 1 ? `Umowa — część ${c.part_no > 0 && c.part_no < 100 ? c.part_no : "?"}${c.part_title ? `: ${c.part_title}` : ""}${c.part_no === scopePart ? " (zakres rekordu)" : ""}` : "Umowa"}>
              <Defs
                rows={[
                  ["Wykonawca", c.contractor_name ? `${c.contractor_name}${c.contractor_nip ? ` (${c.contractor_nip})` : ""}` : null],
                  ["Wartość umowy", c.initial_value != null ? pln(c.initial_value) : null],
                  ["Wypłacono", c.paid_total != null ? pln(c.paid_total) : null],
                  ["Zawarcie", c.signed_at ? date(c.signed_at) : null],
                  ["Pierwotny termin", c.planned_end ? `${date(c.planned_end)}${c.initial_months ? ` (${c.initial_months} mies.)` : ""}` : null],
                  ["Wykonanie", c.actual_end ? date(c.actual_end) : null],
                  ["Oferty", c.offers_count != null ? `${c.offers_count}${c.lowest_offer != null ? ` · ${pln(c.lowest_offer)} – ${pln(c.highest_offer)}` : ""}` : null],
                  ["Należyte wykonanie", c.performed_properly == null ? null : c.performed_properly ? "tak" : "nie"],
                ]}
              />
            </Section>
          ))}

          {!!primary?.changes.length && (
            <Section title={`Zmiany umowy (${primary.changes.length})`}>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Nr</TableHead>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Podstawa</TableHead>
                      <TableHead>Przyczyna</TableHead>
                      <TableHead className="text-right">Wartość</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {primary.changes.map((ch) => {
                      const src = sources[ch.source_id];
                      return (
                        <TableRow key={ch.id}>
                          <TableCell>{ch.change_no ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap tabular-nums">{ch.changed_at ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{ch.legal_basis?.replace(/\s*ustawy\s*$/, "") ?? "—"}</TableCell>
                          <TableCell className="max-w-md text-xs whitespace-normal">
                            <span className="line-clamp-2">{ch.reason}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{ch.value_change != null ? pln(ch.value_change) : ch.new_end_date ? `termin → ${ch.new_end_date}` : "—"}</TableCell>
                          <TableCell>
                            {src && (
                              <Link
                                href={sourceViewHref(src.id, ch.reason ?? ch.description, project.id)}
                                aria-label={`Pokaż fragment w źródle: ${src.external_id ?? src.title}`}
                                title={`Pokaż fragment: ${src.external_id ?? src.title}${ch.related_source_ids?.length ? ` (także w ${ch.related_source_ids.length} innym ogłoszeniu)` : ""}`}
                                className="text-muted-foreground hover:text-primary"
                              >
                                <FileSearchIcon className="size-3.5" />
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {primary && (
            <Section title="Dopasowanie do BZP">
              {withMatchDialog(
                <Button size="sm" variant="outline" className="self-start">
                  Zmień przetarg
                </Button>,
              )}
              <Defs
                rows={[
                  ["Postępowanie", primary.bzp_number],
                  ["Identyfikator (OCID)", <span key="ocid" className="font-mono text-xs break-all">{primary.ocid}</span>],
                  ["Metoda", primary.match_method === "notice_number" ? "po numerze ogłoszenia" : primary.match_method === "manual" ? "wskazane przez eksperta" : "wyszukiwanie po NIP i nazwie"],
                  ["Pewność", `${Math.round(primary.match_confidence * 100)}%`],
                  ["Podstawa", primary.match_basis.join("; ")],
                ]}
              />
            </Section>
          )}

          <Section title="Rekord">
            <Defs
              rows={[
                ["Identyfikator", project.id],
                ["NIP zamawiającego", project.beneficiary_nip],
                [project.public_id_type ?? "Identyfikator publiczny", project.public_id],
                ["Zakres", project.record_scope],
                ["Rodzaj robót", project.works_type],
                ["Podsektory dodatkowe", project.subsectors_extra.join(", ")],
                ["Adnotacja", project.annotation],
              ]}
            />
          </Section>

          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-semibold">
              Źródła i zapytania
              <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3 pt-2">
              <p className="text-xs text-muted-foreground">Kwoty i daty przepisane z ogłoszeń BZP; odchylenia (koszt, czas) obliczone z tych danych.</p>
              <ul className="flex flex-col gap-1">
                {primary?.notices.map((n) => (
                  <li key={n.id}>
                    <SourceLink source={sources[n.source_id]} label={`${noticeLabel[n.notice_type] ?? n.notice_type} ${n.notice_number}`} />
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5 border-t pt-2 text-xs">
                {project.enrichment_log.map((entry, i) => (
                  <li key={i} className="flex flex-col">
                    <span>
                      {entry.step}
                      {entry.count != null && ` (${entry.count})`} — <span className="text-muted-foreground">{entry.detail}</span>
                    </span>
                    {entry.url && (
                      <a href={entry.url} target="_blank" rel="noreferrer" className="break-all text-muted-foreground hover:text-primary">
                        {entry.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>
      </Tabs>
    </>
  );
}
