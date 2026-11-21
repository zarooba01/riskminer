import { CheckCircle2Icon, CircleAlertIcon, CircleDashedIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { sourceViewHref } from "@/lib/rm/highlight";
import type { ExternalCheck } from "@/lib/rm/types";

const sourceLabel: Record<ExternalCheck["source"], string> = {
  platform: "Strona postępowania zamawiającego (platforma zakupowa / BIP)",
  ted: "TED — Dziennik Urzędowy UE",
};

const statusView: Record<ExternalCheck["status"], { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  found: { label: "potwierdzone", icon: <CheckCircle2Icon className="size-3.5" aria-hidden />, variant: "default" },
  not_found: { label: "nie znaleziono", icon: <CircleDashedIcon className="size-3.5" aria-hidden />, variant: "secondary" },
  error: { label: "nie odczytano", icon: <CircleAlertIcon className="size-3.5" aria-hidden />, variant: "destructive" },
  skipped: { label: "pominięto", icon: <CircleDashedIcon className="size-3.5" aria-hidden />, variant: "outline" },
};

/** Dokumenty, które najczęściej mówią o przebiegu: umowa, wybór oferty, otwarcie ofert, aneksy. */
const keyDocument = /umow|aneks|wyb[oó]r|otwarci|kwot|protok|unieważni|zmian/i;

type Props = { projectId: string; bzpNotices: number; checks: ExternalCheck[] };

/** Lista sprawdzonych źródeł: BZP + źródła dodatkowe, z wynikiem i podstawą dopasowania. */
export function ExternalSources({ projectId, bzpNotices, checks }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      <li className="flex flex-col gap-1 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">BZP / e-Zamówienia</span>
          <Badge variant={bzpNotices ? "default" : "secondary"} className="gap-1">
            {bzpNotices ? statusView.found.icon : statusView.not_found.icon} {bzpNotices ? `${bzpNotices} ogłoszeń` : "brak ogłoszeń"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Ogłoszenia o zamówieniu, wyniku, zmianach i wykonaniu umowy połączone identyfikatorem postępowania (OCID).</p>
      </li>
      {(["platform", "ted"] as const).map((kind) => {
        const check = checks.find((c) => c.source === kind);
        if (!check) {
          return (
            <li key={kind} className="flex flex-col gap-1 rounded-lg border border-dashed p-3">
              <span className="text-sm font-medium">{sourceLabel[kind]}</span>
              <p className="text-xs text-muted-foreground">Jeszcze nie sprawdzono — uruchom ponowne wzbogacenie projektu.</p>
            </li>
          );
        }
        const view = statusView[check.status];
        const docs = check.details.documents ?? [];
        const keyDocs = docs.filter((d) => keyDocument.test(d.name));
        const docSources = check.details.documentSources ?? [];
        return (
          <li key={kind} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{sourceLabel[kind]}</span>
              <Badge variant={view.variant} className="gap-1">
                {view.icon} {view.label}
              </Badge>
              {check.confidence != null && <span className="text-xs text-muted-foreground">pewność {Math.round(check.confidence * 100)}%</span>}
            </div>
            {check.title && <p className="text-sm">{check.title}</p>}
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {check.basis.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {check.source_id && (
                <Link href={sourceViewHref(check.source_id, null, projectId)} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  <FileTextIcon className="size-3" aria-hidden /> zapisana treść
                </Link>
              )}
              {check.url && (
                <a href={check.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                  {kind === "ted" && check.status !== "found" ? "wyszukiwarka TED" : "oryginał"} <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              )}
              {check.details.buyerSite && (
                <a href={check.details.buyerSite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                  strona zamawiającego (BIP) <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              )}
              <span className="text-muted-foreground">· sprawdzono {check.checked_at.slice(0, 16).replace("T", " ")}</span>
            </div>
            {(keyDocs.length > 0 || docSources.length > 0) && (
              <div className="flex flex-col gap-1 border-t pt-2">
                <span className="text-xs font-medium">Kluczowe dokumenty zamawiającego</span>
                <ul className="flex flex-col gap-0.5 text-xs">
                  {docSources.map((d) => (
                    <li key={d.sourceId}>
                      <Link href={sourceViewHref(d.sourceId, null, projectId)} className="text-primary underline-offset-4 hover:underline">
                        {d.name}
                      </Link>{" "}
                      <span className="text-muted-foreground">(treść odczytana)</span>
                    </li>
                  ))}
                  {keyDocs
                    .filter((d) => !docSources.some((s) => s.url === d.url))
                    .map((d) => (
                      <li key={d.url}>
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                          {d.name}
                        </a>
                        {d.date && <span className="text-muted-foreground"> · {d.date}</span>}
                      </li>
                    ))}
                </ul>
                {docs.length > keyDocs.length && <span className="text-xs text-muted-foreground">Wszystkich dokumentów na stronie: {docs.length}.</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
