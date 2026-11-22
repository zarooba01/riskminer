import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { date, pct, pln } from "@/lib/rm/format";
import { sourceViewHref } from "@/lib/rm/highlight";
import type { Contract, ContractChange, Notice } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

import { MissingData } from "./missing-data";

/** Odwołanie do miejsca w źródle: podgląd z zaznaczonym fragmentem (cytat = etykieta pola formularza BZP). */
type Cite = { label: string; sourceId?: string | null; quote?: string };

type Cell = { value: string | null; cite?: Cite };
type Row = { label: string; plan: Cell; actual: Cell; diff: string | null; alert?: boolean; note?: string };

const daysDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const signedDays = (d: number) => `${d > 0 ? "+" : ""}${d} dni`;

function CiteLink({ cite, projectId }: { cite?: Cite; projectId: string }) {
  if (!cite) return null;
  return cite.sourceId ? (
    <Link href={sourceViewHref(cite.sourceId, cite.quote, projectId)} className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
      {cite.label}
    </Link>
  ) : (
    <span className="text-xs text-muted-foreground">{cite.label}</span>
  );
}

function ValueCell({ cell, projectId }: { cell: Cell; projectId: string }) {
  return (
    <TableCell className="align-top">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium tabular-nums">{cell.value ?? <MissingData text="brak w źródle" />}</span>
        {cell.value && <CiteLink cite={cell.cite} projectId={projectId} />}
      </div>
    </TableCell>
  );
}

/** Wiersze planu i wykonania dla jednej umowy (części). */
function rowsFor(contract: Contract, changes: ContractChange[], notices: Notice[], budget?: { amount: number; sourceId: string; document: string; quote: string } | null): Row[] {
  const noticeIn = (type: string) => notices.find((n) => n.notice_type === type && contract.source_ids.includes(n.source_id));
  const result = noticeIn("TenderResultNotice");
  const performing = noticeIn("ContractPerformingNotice");
  const own = changes.filter((ch) => ch.contract_id === contract.id);
  const valueChanges = own.filter((ch) => ch.value_change);
  const valueSum = valueChanges.reduce((a, ch) => a + Number(ch.value_change), 0);
  const lastTerm = own.filter((ch) => ch.new_end_date).sort((a, b) => a.new_end_date!.localeCompare(b.new_end_date!)).at(-1);

  const rows: Row[] = [];
  const paidDiff = contract.paid_total != null && contract.initial_value != null ? contract.paid_total - contract.initial_value : null;
  rows.push({
    label: "Wynagrodzenie",
    plan: { value: contract.initial_value != null ? pln(contract.initial_value) : null, cite: { label: result ? `umowa · ${result.notice_number}` : "umowa", sourceId: result?.source_id, quote: "Wartość umowy/umowy ramowej" } },
    actual: { value: contract.paid_total != null ? pln(contract.paid_total) : null, cite: { label: performing ? `wypłacono · ${performing.notice_number}` : "wypłacono", sourceId: performing?.source_id, quote: "Łączna wartość wynagrodzenia wypłacona" } },
    diff: paidDiff != null ? `${paidDiff > 0 ? "+" : ""}${pln(paidDiff)} (${pct(contract.cost_deviation_pct)})` : null,
    alert: (contract.cost_deviation_pct ?? 0) > 0,
  });
  if (valueChanges.length && contract.initial_value != null) {
    const amended = contract.initial_value + valueSum;
    rows.push({
      label: "Wynagrodzenie po zmianach umowy",
      plan: { value: pln(amended), cite: { label: `zmiany nr ${valueChanges.map((c) => c.change_no ?? "—").join(", ")}: ${valueSum > 0 ? "+" : ""}${pln(valueSum)}`, sourceId: valueChanges[0].source_id, quote: valueChanges[0].reason ?? undefined } },
      actual: { value: contract.paid_total != null ? pln(contract.paid_total) : null },
      diff: contract.paid_total != null ? `${contract.paid_total - amended > 0 ? "+" : ""}${pln(contract.paid_total - amended)}` : null,
      alert: contract.paid_total != null && contract.paid_total - amended > 1,
      note: contract.paid_total != null && Math.abs(contract.paid_total - amended) < 1 ? "wzrost w całości wynika ze zmian umowy" : undefined,
    });
  }
  if (budget && contract.paid_total != null) {
    rows.push({
      label: "Budżet zamawiającego",
      plan: { value: pln(budget.amount), cite: { label: budget.document, sourceId: budget.sourceId, quote: budget.quote } },
      actual: { value: pln(contract.paid_total) },
      diff: `${contract.paid_total - budget.amount > 0 ? "+" : ""}${pln(contract.paid_total - budget.amount)}`,
      alert: contract.paid_total > budget.amount,
    });
  }
  rows.push({
    label: "Termin zakończenia",
    plan: { value: contract.planned_end ? date(contract.planned_end) : null, cite: { label: `pierwotny${contract.initial_months ? ` · ${contract.initial_months} mies.` : ""}`, sourceId: result?.source_id, quote: "Okres realizacji zamówienia" } },
    actual: { value: contract.actual_end ? date(contract.actual_end) : null, cite: { label: performing ? `wykonanie · ${performing.notice_number}` : "wykonanie", sourceId: performing?.source_id, quote: "Termin wykonania umowy" } },
    diff: contract.on_time === true ? "w terminie" : contract.planned_end && contract.actual_end ? signedDays(daysDiff(contract.planned_end, contract.actual_end)) : null,
    alert: (contract.delay_days ?? 0) > 0 && contract.on_time !== true,
    note:
      contract.on_time === true && contract.planned_end && contract.actual_end && contract.actual_end > contract.planned_end
        ? "wg ogłoszenia o wykonaniu umowę wykonano w pierwotnym terminie — okres realizacji liczono od innej daty niż podpisanie umowy"
        : undefined,
  });
  if (lastTerm?.new_end_date) {
    const d = contract.actual_end ? daysDiff(lastTerm.new_end_date, contract.actual_end) : null;
    rows.push({
      label: "Termin po zmianach umowy",
      plan: { value: date(lastTerm.new_end_date), cite: { label: `zmiana nr ${lastTerm.change_no ?? "—"}`, sourceId: lastTerm.source_id, quote: lastTerm.description ?? lastTerm.reason ?? undefined } },
      actual: { value: contract.actual_end ? date(contract.actual_end) : null },
      diff: d != null ? signedDays(d) : null,
      alert: d != null && d > 0,
      note: d != null ? (d <= 0 ? "zakończono w terminie zmienionym aneksem" : "zakończono po terminie zmienionym aneksem") : undefined,
    });
  }
  return rows;
}

function PlanTable({ rows, projectId }: { rows: Row[]; projectId: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48" />
            <TableHead>Plan</TableHead>
            <TableHead>Wykonanie</TableHead>
            <TableHead className="text-right">Różnica</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="align-top text-sm text-muted-foreground">{row.label}</TableCell>
              <ValueCell cell={row.plan} projectId={projectId} />
              <ValueCell cell={row.actual} projectId={projectId} />
              <TableCell className="text-right align-top">
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn("text-sm font-semibold tabular-nums", row.alert && "text-destructive")}>{row.diff ?? <MissingData text="nie da się obliczyć" />}</span>
                  {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type Props = {
  projectId: string;
  contracts: Contract[];
  changes: ContractChange[];
  notices: Notice[];
  /** Kwota przeznaczona na sfinansowanie zamówienia (dokument zamawiającego), jeśli znaleziona. */
  budget?: { amount: number; sourceId: string; document: string; quote: string } | null;
  /** Część z zakresu rekordu (otwierana domyślnie). */
  scopePart?: number;
};

const partLabel = (c: Contract) => (c.part_no > 0 && c.part_no < 100 ? `Część ${c.part_no}` : "Umowa");

/**
 * Plan i wykonanie obok siebie: wynagrodzenie z umowy vs wypłata, pierwotny termin vs faktyczne zakończenie,
 * oraz stan po zmianach umowy. Każda wartość prowadzi do fragmentu ogłoszenia, z którego pochodzi.
 * Zamówienie w częściach: osobna karta dla każdej części.
 */
export function PlanVsActual({ projectId, contracts, changes, notices, budget, scopePart }: Props) {
  if (!contracts.length) return null;
  if (contracts.length === 1) return <PlanTable rows={rowsFor(contracts[0], changes, notices, budget)} projectId={projectId} />;
  const initial = contracts.find((c) => c.part_no === scopePart) ?? contracts[0];
  return (
    <Tabs defaultValue={initial.id}>
      <TabsList className="max-w-full flex-wrap justify-start overflow-x-auto">
        {contracts.map((c) => (
          <TabsTrigger key={c.id} value={c.id}>
            {partLabel(c)}
            {c.part_no === scopePart ? " (rekord)" : ""}
          </TabsTrigger>
        ))}
      </TabsList>
      {contracts.map((c) => (
        <TabsContent key={c.id} value={c.id} className="flex flex-col gap-2 pt-2">
          {(c.part_title || c.contractor_name) && (
            <p className="text-sm text-muted-foreground">
              {[c.part_title, c.contractor_name && `wykonawca: ${c.contractor_name}`].filter(Boolean).join(" · ")}
            </p>
          )}
          <PlanTable rows={rowsFor(c, changes, notices, null)} projectId={projectId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
