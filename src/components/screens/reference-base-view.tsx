import { DatabaseIcon, InfoIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/rm/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReferenceBase } from "@/lib/assess/queries";
import { days, pct, plnShort, type ActionResult } from "@/lib/rm/format";
import { cn } from "@/lib/utils";

type Props = {
  data: ReferenceBase;
  rebuild?: () => Promise<ActionResult>;
};

/** Baza porównawcza: sklonowane zakończone projekty z zaakceptowanymi zdarzeniami — jedyne źródło przypadków w ocenach. */
export function ReferenceBaseView({ data, rebuild }: Props) {
  const { cases, lastBuild } = data;
  const auto = cases.filter((c) => c.match_origin === "auto").length;
  const events = cases.reduce((a, c) => a + c.events, 0);
  return (
    <>
      <PageHeader
        title="Baza porównawcza"
        description="Zakończone inwestycje, na których opiera się ocena nowej inwestycji: kopia danych z bazy roboczej z zaakceptowanymi dopasowaniami i zdarzeniami ryzyka."
        actions={
          rebuild && (
            <ActionButton variant="outline" action={rebuild} pendingLabel="Buduję bazę…">
              <RefreshCwIcon aria-hidden /> Odbuduj z bazy roboczej
            </ActionButton>
          )
        }
      />
      <Alert>
        <InfoIcon />
        <AlertTitle>Kopia z automatyczną akceptacją (dane demo)</AlertTitle>
        <AlertDescription>
          Do analizy bierzemy wyłącznie inwestycje zakończone, z dopasowaniem do BZP i z zaakceptowanymi zdarzeniami ryzyka. Akceptacja w tej kopii jest automatyczna
          (oznaczenie „Automatyczna akceptacja (dane demo)”) — oryginalne rekordy w Zrealizowanych inwestycjach i Weryfikacji pozostają bez zmian, do decyzji eksperta.
          {lastBuild && ` Ostatnia budowa: ${lastBuild.at.slice(0, 16).replace("T", " ")}.`}
        </AlertDescription>
      </Alert>

      {cases.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseIcon className="size-4" aria-hidden /> Zakończone inwestycje ({cases.length})
            </CardTitle>
            <CardDescription>
              Zaakceptowanych zdarzeń: {events}. Dopasowanie do BZP zatwierdzone wcześniej: {cases.length - auto}, zaakceptowane automatycznie przy klonowaniu: {auto}.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inwestycja</TableHead>
                  <TableHead className="hidden lg:table-cell">Podsektor</TableHead>
                  <TableHead className="text-right">Wartość umowy</TableHead>
                  <TableHead className="text-right">Zmiana kosztu</TableHead>
                  <TableHead className="text-right">Opóźnienie</TableHead>
                  <TableHead>Ryzyka</TableHead>
                  <TableHead>Dopasowanie BZP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.project_id}>
                    <TableCell className="max-w-sm whitespace-normal">
                      <Link href={`/projects/${encodeURIComponent(c.project_id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {c.project_id}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{c.title}</span>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {c.subsector_main ?? "—"}
                      <span className="block text-xs text-muted-foreground">
                        {c.works_type ?? "—"} · {c.province ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{plnShort(c.value)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", (c.cost_deviation_pct ?? 0) > 10 && "text-destructive")}>{pct(c.cost_deviation_pct)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", (c.delay_days ?? 0) > 60 && "text-destructive")}>{days(c.delay_days)}</TableCell>
                    <TableCell className="text-xs">
                      {c.events} · {c.risk_codes.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.match_origin === "auto" ? "secondary" : "outline"}>
                        {c.match_origin === "auto" ? `automatycznie (${Math.round((c.match_confidence ?? 0) * 100)}%)` : "zatwierdzone"}
                      </Badge>
                      {c.bzp_number && <span className="block text-xs text-muted-foreground">{c.bzp_number}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Baza porównawcza jest pusta</EmptyTitle>
            <EmptyDescription>Użyj „Odbuduj z bazy roboczej”, żeby skopiować zakończone inwestycje z zaakceptowanymi danymi.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {lastBuild && lastBuild.skipped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pominięte przy ostatniej budowie ({lastBuild.skipped.length})</CardTitle>
            <CardDescription>Inwestycje, które nie spełniły warunków bazy porównawczej.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {lastBuild.skipped.map((s) => (
                <li key={s.projectId}>
                  <Link href={`/projects/${encodeURIComponent(s.projectId)}`} className="text-primary underline-offset-4 hover:underline">
                    {s.projectId}
                  </Link>{" "}
                  — {s.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
