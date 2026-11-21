"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/rm/action-button";
import { AssessmentKindBadge } from "@/components/rm/assessment-kind-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssessmentListItem } from "@/lib/assess/queries";
import { pct, plnShort, type ActionResult } from "@/lib/rm/format";

type Props = {
  assessments: AssessmentListItem[];
  remove?: (id: string) => Promise<ActionResult>;
};

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** Zapisane oceny nowych inwestycji: można do nich wrócić, przefiltrować je, zaktualizować i wyeksportować. */
export function AssessmentsView({ assessments, remove }: Props) {
  const [query, setQuery] = useState("");
  const visible = assessments.filter((a) => !query || `${a.title} ${a.description} ${a.mode === "ai" ? "AI" : "deterministyczna"} ${a.params?.subsector_main ?? ""} ${a.params?.province ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Zapisane oceny"
        description="Oceny nowych inwestycji zapisane w bazie. Otwórz, żeby zobaczyć podobne przypadki, ryzyka i zalecenia, zaktualizować wynik albo wyeksportować go do JSON lub CSV."
        actions={
          <Button asChild>
            <Link href="/assessments/new">
              <PlusIcon aria-hidden /> Nowa ocena
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Oceny ({assessments.length})</CardTitle>
          <CardDescription>Każdą ocenę można otworzyć, zaktualizować na bieżącej bazie i wyeksportować do JSON lub CSV.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {assessments.length > 0 && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtruj po nazwie, opisie, podsektorze, województwie…" className="sm:max-w-sm" aria-label="Filtruj oceny" />}
          {visible.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inwestycja</TableHead>
                  <TableHead>Rodzaj oceny</TableHead>
                  <TableHead className="hidden md:table-cell">Podsektor</TableHead>
                  <TableHead className="text-right">Próba</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Koszt (mediana)</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Budżet</TableHead>
                  <TableHead className="hidden lg:table-cell">Aktualizacja</TableHead>
                  {remove && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((a) => {
                  const s = a.summary as AssessmentListItem["summary"] & { included?: number };
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-md">
                        <Link href={`/assessments/${a.id}`} className="line-clamp-2 font-medium text-primary underline-offset-4 hover:underline">
                          {a.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {a.items} pozycji · wersja {a.version}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AssessmentKindBadge ai={a.mode === "ai"} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{a.params?.subsector_main ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.included ?? "—"}
                        {"uncertainty" in s && s.uncertainty && (
                          <Badge variant={s.uncertainty === "duża" ? "destructive" : "secondary"} className="ml-2 hidden xl:inline-flex">
                            niepewność {s.uncertainty}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{"cost" in s ? pct(s.cost?.median ?? null) : "—"}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{plnShort(a.params?.budget_pln ?? null)}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{when(a.updated_at)}</TableCell>
                      {remove && (
                        <TableCell>
                          <ActionButton size="icon" variant="ghost" action={() => remove(a.id)} aria-label={`Usuń ocenę ${a.title}`} pendingLabel="">
                            <Trash2Icon />
                          </ActionButton>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{assessments.length ? "Brak ocen pasujących do filtra" : "Nie ma jeszcze żadnej oceny"}</EmptyTitle>
                <EmptyDescription>{assessments.length ? "Zmień treść filtra." : "Utwórz pierwszą ocenę przyciskiem „Nowa ocena”."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </>
  );
}
