import { ChevronDownIcon, HistoryIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ChangeReport, ReportFieldChange } from "@/lib/rm/types";

const statusLabel: Record<string, string> = { proposed: "do weryfikacji", accepted: "zatwierdzone", rejected: "odrzucone" };
const originLabel: Record<string, string> = { rule: "reguła", llm: "AI", expert: "ekspert" };
const findingLabel: Record<string, string> = { confirms: "potwierdza", adds: "uzupełnia", conflicts: "rozbieżność" };

const show = (field: string, v: string | number | null) => {
  if (v == null || v === "") return "—";
  if (field === "status") return statusLabel[String(v)] ?? String(v);
  const text = typeof v === "number" ? v.toLocaleString("pl-PL") : v;
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
};

function Fields({ fields }: { fields: ReportFieldChange[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {fields.map((f) => (
        <li key={f.field} className="grid gap-0.5 text-xs sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
          <span className="text-muted-foreground">{f.label}</span>
          <span className="break-words">
            <span className="text-muted-foreground line-through">{show(f.field, f.before)}</span> → <span>{show(f.field, f.after)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Counts({ report }: { report: ChangeReport }) {
  const s = report.summary;
  const items = [
    s.added.length && `nowe: ${s.added.length}`,
    s.changed.length && `zmienione: ${s.changed.length}`,
    s.removed.length && `usunięte: ${s.removed.length}`,
    s.contracts.length && `umowy: ${s.contracts.length}`,
    s.findingsAdded.length && `ustalenia z dokumentu: ${s.findingsAdded.length}`,
  ].filter(Boolean) as string[];
  return items.length ? (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i} variant="outline">
          {i}
        </Badge>
      ))}
    </span>
  ) : (
    <Badge variant="secondary">bez zmian</Badge>
  );
}

/**
 * Raport „co się zmieniło” po ostatniej ponownej analizie (wzbogacenie, analiza AI, nowy dokument):
 * dodane, zmienione (pole: było → jest) i usunięte ustalenia oraz zmiany w umowach. Starsze raporty zwinięte.
 */
export function ChangeReportCard({ reports }: { reports: ChangeReport[] }) {
  if (!reports.length) return null;
  const [latest, ...older] = reports;
  const s = latest.summary;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HistoryIcon className="size-4" aria-hidden /> Co się zmieniło po ostatniej analizie
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>
            {latest.trigger} · {latest.created_at.slice(0, 16).replace("T", " ")}
          </span>
          <Counts report={latest} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {s.changes.before !== s.changes.after && (
          <p>
            Zmiany umowy w źródłach: {s.changes.before} → {s.changes.after}
          </p>
        )}
        {s.contracts.map((c) => (
          <section key={c.label}>
            <h4 className="text-xs font-semibold">{c.label}</h4>
            <Fields fields={c.fields} />
          </section>
        ))}
        {s.added.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold">Nowe ustalenia</h4>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {s.added.map((e) => (
                <li key={e.id}>
                  <span className="font-mono">{e.risk_code}</span> {e.title} <span className="text-muted-foreground">({originLabel[e.origin] ?? e.origin})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {s.changed.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold">Zmienione ustalenia</h4>
            <ul className="mt-1 flex flex-col gap-2">
              {s.changed.map((c) => (
                <li key={c.event.id} className="text-xs">
                  <span className="font-mono">{c.event.risk_code}</span> {c.event.title}
                  <Fields fields={c.fields} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {s.removed.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold">Usunięte (źródła już ich nie wskazują)</h4>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {s.removed.map((e) => (
                <li key={e.id} className="line-through">
                  <span className="font-mono">{e.risk_code}</span> {e.title}
                </li>
              ))}
            </ul>
          </section>
        )}
        {s.findingsAdded.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold">Nowe ustalenia z dokumentu</h4>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {s.findingsAdded.map((f) => (
                <li key={f.id}>
                  <span className="text-muted-foreground">{findingLabel[f.kind] ?? f.kind}:</span> {f.statement}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-muted-foreground">
          Bez zmian: {s.unchanged}. Decyzje eksperta zachowane: {s.decisionsKept}.
        </p>
        {older.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium">
              Wcześniejsze analizy ({older.length})
              <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 flex flex-col gap-1.5">
                {older.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{r.created_at.slice(0, 16).replace("T", " ")}</span>
                    <span>{r.trigger}</span>
                    <Counts report={r} />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
