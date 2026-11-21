"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { days, pct } from "@/lib/rm/format";

export type ProjectListItem = {
  id: string;
  title: string;
  beneficiary_name: string;
  province: string | null;
  subsector_main: string | null;
  public_id_type: string | null;
  enriched_at: string | null;
  procurements: number;
  contract: { cost_deviation_pct: number | null; delay_days: number | null } | null;
  events: { proposed: number; accepted: number };
};

function Deviation({ item }: { item: ProjectListItem }) {
  if (!item.enriched_at) return <Badge variant="outline">niewzbogacony</Badge>;
  if (!item.procurements) return <Badge variant="destructive">brak dopasowania</Badge>;
  if (!item.contract) return <Badge variant="secondary">brak danych o umowie</Badge>;
  return (
    <span className="tabular-nums text-sm">
      koszt {pct(item.contract.cost_deviation_pct)} · czas {days(item.contract.delay_days)}
    </span>
  );
}

export function ProjectsListView({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => `${p.id} ${p.title} ${p.beneficiary_name} ${p.subsector_main}`.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  return (
    <>
      <PageHeader title="Projekty" description="Rekordy z pliku organizatora wzbogacone danymi z BZP. Odchylenia liczone z ogłoszeń o wykonaniu umowy." />
      <Input aria-label="Szukaj projektów" placeholder="Szukaj: nazwa, gmina, podsektor…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Brak projektów</EmptyTitle>
            <EmptyDescription>Zaimportuj plik na pulpicie.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Przedsięwzięcie</TableHead>
                  <TableHead>Podsektor</TableHead>
                  <TableHead>Postępowania</TableHead>
                  <TableHead>Odchylenie</TableHead>
                  <TableHead className="text-right">Zdarzenia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
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
                    <TableCell>{p.procurements}</TableCell>
                    <TableCell>
                      <Deviation item={p} />
                    </TableCell>
                    <TableCell className="text-right">
                      {p.events.proposed > 0 && <Badge variant="secondary">{p.events.proposed} do weryfikacji</Badge>}{" "}
                      {p.events.accepted > 0 && <Badge>{p.events.accepted} zatw.</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <ul className="flex flex-col gap-3 md:hidden">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>
                  <Card className="gap-2 py-4">
                    <CardContent className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                      <span className="font-medium leading-snug">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.beneficiary_name}</span>
                      <Deviation item={p} />
                      {p.events.proposed > 0 && <Badge variant="secondary">{p.events.proposed} do weryfikacji</Badge>}
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
