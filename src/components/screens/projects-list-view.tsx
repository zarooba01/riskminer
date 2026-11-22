"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CheckIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MatchDialog, type MatchActions } from "@/components/rm/match-dialog";
import { days, pct, type ActionResult } from "@/lib/rm/format";
import type { MatchInfo } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

import { AddProjectDialog, type AddProjectDialogProps } from "./add-project-dialog";
import { AddProjectsDialog, type AddProjectsDialogProps } from "./add-projects-dialog";
import { ClearDataButton } from "./clear-data-button";

export type ProjectListItem = {
  id: string;
  title: string;
  beneficiary_name: string;
  province: string | null;
  subsector_main: string | null;
  public_id_type: string | null;
  enriched_at: string | null;
  procurements: number;
  matchStatus?: "accepted" | "proposed" | null;
  match?: MatchInfo | null;
  /** Czy projekt był już wyszukiwany w BZP (log zapytań niepusty). */
  enrichment_log?: unknown[];
  matchRejected?: boolean;
  beneficiary_nip?: string | null;
  public_id?: string | null;
  contract: { cost_deviation_pct: number | null; delay_days: number | null } | null;
  events: { proposed: number; accepted: number };
};

type SortKey = "id" | "match" | "cost" | "delay" | "events";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const sortLabels: Record<SortKey, string> = { id: "ID", match: "Dopasowanie", cost: "Koszt", delay: "Czas", events: "Zdarzenia" };

/** Kolejność stanów dopasowania: wymagające działania najpierw (rosnąco). */
const searched = (p: ProjectListItem) => Boolean(p.enriched_at || p.match || p.enrichment_log?.length);
const matchRank = (p: ProjectListItem) => (!p.match ? (searched(p) ? 0 : 1) : p.match.status === "proposed" ? 1 : 2);

/** Wartość do sortowania; brak danych zawsze na końcu, niezależnie od kierunku. */
function sortValue(p: ProjectListItem, key: SortKey): number | string | null {
  if (key === "id") return p.id;
  if (key === "match") return matchRank(p);
  if (key === "cost") return p.contract?.cost_deviation_pct ?? null;
  if (key === "delay") return p.contract?.delay_days ?? null;
  return p.events.proposed + p.events.accepted;
}

function compare(a: ProjectListItem, b: ProjectListItem, sort: Sort) {
  const va = sortValue(a, sort.key);
  const vb = sortValue(b, sort.key);
  if (va === null && vb === null) return a.id.localeCompare(b.id);
  if (va === null) return 1;
  if (vb === null) return -1;
  const diff = typeof va === "string" ? va.localeCompare(String(vb), "pl", { numeric: true }) : va - (vb as number);
  return (sort.dir === "asc" ? diff : -diff) || a.id.localeCompare(b.id);
}

/** Stan danych zamiast wartości: niewzbogacony, brak dopasowania w BZP, brak ogłoszeń o umowie. */
function DataState({ item }: { item: ProjectListItem }) {
  if (item.match?.status === "proposed") return <span className="text-xs text-muted-foreground">po dopasowaniu</span>;
  if (!item.match) return <span className="text-xs text-muted-foreground">{searched(item) ? "brak przetargu" : "niewzbogacony"}</span>;
  if (!item.contract) return <Badge variant="secondary">brak danych</Badge>;
  return null;
}

/** Stan powiązania projekt ↔ przetarg BZP; kliknięcie otwiera okno sprawdzenia, akceptacji lub wskazania przetargu. */
function MatchCell({ item, actions }: { item: ProjectListItem; actions?: MatchActions }) {
  const label = item.match ? (
    item.match.status === "accepted" ? (
      <span className="inline-flex items-center gap-1 font-mono text-xs whitespace-nowrap">
        <CheckIcon className="size-3.5 text-success" aria-hidden />
        {item.match.bzp_number}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border border-warning/60 bg-warning/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
        <LinkIcon className="size-3" aria-hidden /> Dopasuj
      </span>
    )
  ) : (
    <span className="text-xs font-medium whitespace-nowrap text-destructive">Brak — wskaż przetarg</span>
  );
  if (!actions) return label;
  const project = {
    id: item.id,
    title: item.title,
    beneficiary_name: item.beneficiary_name,
    beneficiary_nip: item.beneficiary_nip ?? null,
    public_id_type: item.public_id_type,
    public_id: item.public_id ?? null,
  };
  return (
    <MatchDialog project={project} match={item.match ?? null} actions={actions}>
      <button type="button" className="rounded-md px-1 py-0.5 text-left hover:bg-muted" aria-label={`Powiązanie z przetargiem: ${item.id}`}>
        {label}
      </button>
    </MatchDialog>
  );
}

function CostCell({ item }: { item: ProjectListItem }) {
  const v = item.contract?.cost_deviation_pct;
  if (v == null) return item.contract ? <span className="text-muted-foreground">—</span> : <DataState item={item} />;
  return <span className={cn("tabular-nums", v > 10 && "font-semibold text-destructive")}>{pct(v)}</span>;
}

function DelayCell({ item }: { item: ProjectListItem }) {
  const v = item.contract?.delay_days;
  if (v == null) return item.contract ? <span className="text-muted-foreground">—</span> : <DataState item={item} />;
  return <span className={cn("tabular-nums", v > 60 && "font-semibold text-destructive")}>{days(v)}</span>;
}

function EventsCell({ item }: { item: ProjectListItem }) {
  return (
    <span className="inline-flex flex-wrap gap-1 md:justify-end">
      {item.events.proposed > 0 && <Badge variant="secondary">{item.events.proposed} do weryfikacji</Badge>}
      {item.events.accepted > 0 && <Badge>{item.events.accepted} zatw.</Badge>}
      {!item.events.proposed && !item.events.accepted && <span className="text-muted-foreground">—</span>}
    </span>
  );
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Button variant="ghost" size="sm" className="-mx-2 h-8 px-2" onClick={() => onSort(k)}>
        {label}
        <Icon className={cn("size-3.5", !active && "text-muted-foreground")} aria-hidden />
      </Button>
    </TableHead>
  );
}

export function ProjectsListView({
  projects,
  addProject,
  suggestedId,
  enrichAction,
  matchActions,
  clearAction,
  ...add
}: { projects: ProjectListItem[]; matchActions?: MatchActions; clearAction?: () => Promise<ActionResult> } & Partial<AddProjectsDialogProps> & Partial<Pick<AddProjectDialogProps, "addProject" | "suggestedId" | "enrichAction">>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "id", dir: "asc" });

  // Kliknięcie tej samej kolumny odwraca kierunek; nowa kolumna liczbowa zaczyna od największych wartości.
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "id" || key === "match" ? "asc" : "desc" }));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? projects.filter((p) => `${p.id} ${p.title} ${p.beneficiary_name} ${p.subsector_main}`.toLowerCase().includes(q)) : projects;
    return [...filtered].sort((a, b) => compare(a, b, sort));
  }, [projects, query, sort]);

  return (
    <>
      <PageHeader
        title="Zrealizowane inwestycje"
        description="Zaimportowane dane uzupełnione o informacje z BZP. Koszt = wypłacono vs wartość umowy; czas = wykonanie vs pierwotny termin."
        actions={
          <>
            {clearAction && <ClearDataButton projectCount={projects.length} clearAction={clearAction} />}
            {addProject && <AddProjectDialog addProject={addProject} enrichAction={enrichAction} suggestedId={suggestedId} />}
            {add.addAction && <AddProjectsDialog addAction={add.addAction} searchAction={add.searchAction} buildAction={add.buildAction} />}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Szukaj inwestycji" placeholder="Szukaj: nazwa, gmina, podsektor…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2 md:hidden">
          <Select value={`${sort.key}:${sort.dir}`} onValueChange={(v) => {
            const [key, dir] = v.split(":") as [SortKey, Sort["dir"]];
            setSort({ key, dir });
          }}>
            <SelectTrigger aria-label="Sortuj" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(sortLabels) as SortKey[]).flatMap((key) => [
                <SelectItem key={`${key}:asc`} value={`${key}:asc`}>
                  {sortLabels[key]} rosnąco
                </SelectItem>,
                <SelectItem key={`${key}:desc`} value={`${key}:desc`}>
                  {sortLabels[key]} malejąco
                </SelectItem>,
              ])}
            </SelectContent>
          </Select>
        </div>
      </div>
      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Brak inwestycji</EmptyTitle>
            <EmptyDescription>Dodaj inwestycję albo zaimportuj plik.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader label="ID" k="id" sort={sort} onSort={onSort} />
                  <TableHead>Przedsięwzięcie</TableHead>
                  <TableHead>Podsektor</TableHead>
                  <SortHeader label="Dopasowanie" k="match" sort={sort} onSort={onSort} />
                  <SortHeader label="Koszt" k="cost" sort={sort} onSort={onSort} />
                  <SortHeader label="Czas" k="delay" sort={sort} onSort={onSort} />
                  <SortHeader label="Zdarzenia" k="events" sort={sort} onSort={onSort} className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.beneficiary_name} · {p.province} · {p.public_id_type}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{p.subsector_main ?? "—"}</TableCell>
                    <TableCell>
                      <MatchCell item={p} actions={matchActions} />
                    </TableCell>
                    <TableCell>
                      <CostCell item={p} />
                    </TableCell>
                    <TableCell>
                      <DelayCell item={p} />
                    </TableCell>
                    <TableCell className="text-right">
                      <EventsCell item={p} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>
                  <Card className="gap-2 py-4">
                    <CardContent className="flex flex-col gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                      <span className="font-medium leading-snug">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.beneficiary_name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span>
                          koszt <CostCell item={p} />
                        </span>
                        <span>
                          czas <DelayCell item={p} />
                        </span>
                      </span>
                      <EventsCell item={p} />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
