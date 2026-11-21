import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollToFragment } from "@/components/rm/scroll-to-fragment";
import { findQuote, splitByRanges } from "@/lib/rm/highlight";

export type SourceViewData = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  external_id: string | null;
  fetched_at: string;
  text_content: string | null;
  content_hash: string | null;
};

const kindLabel: Record<string, string> = {
  bzp: "Ogłoszenie BZP (e-Zamówienia)",
  upload: "Dokument dodany przez eksperta",
  platform: "Strona postępowania zamawiającego",
  ted: "TED (Dziennik Urzędowy UE)",
  xlsx: "Plik organizatora",
  manual: "Wpis ręczny",
};

const externalLabel: Record<string, string> = {
  bzp: "Otwórz w e-Zamówieniach",
  upload: "Pobierz oryginał",
  platform: "Otwórz stronę postępowania",
  ted: "Otwórz w TED",
};

type Props = {
  source: SourceViewData;
  /** Cytat do zaznaczenia w tekście (z ustalenia, zdarzenia albo zmiany umowy). */
  quote?: string | null;
  /** Adres powrotu (karta projektu). */
  backHref?: string | null;
};

/** Podgląd źródła: pełny tekst zapisany przy pobraniu, z zaznaczonym fragmentem, na którym oparto ustalenie. */
export function SourceView({ source, quote, backHref }: Props) {
  const text = source.text_content ?? "";
  const ranges = findQuote(text, quote);
  const chunks = splitByRanges(text, ranges);
  const firstMark = chunks.findIndex((c) => c.marked);

  return (
    <div className="flex flex-col gap-4">
      {ranges.length > 0 && <ScrollToFragment />}
      <div className="flex flex-wrap items-center gap-2">
        {backHref && (
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeftIcon /> Wróć do projektu
            </Link>
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{source.external_id ?? source.title}</h1>
        <p className="text-sm text-muted-foreground break-words">{source.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{kindLabel[source.kind] ?? source.kind}</Badge>
          <span>pobrano {source.fetched_at.slice(0, 16).replace("T", " ")}</span>
          {source.content_hash && <span className="font-mono">SHA-256 {source.content_hash.slice(0, 12)}…</span>}
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
              {externalLabel[source.kind] ?? "Otwórz oryginał"} <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {quote && (
        <Alert className={ranges.length ? "border-primary/40" : "border-destructive/50"}>
          <AlertDescription className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">{ranges.length ? "Zaznaczony fragment, na którym oparto ustalenie:" : "Tego cytatu nie znaleziono dosłownie w zapisanym tekście źródła:"}</span>
            <span className="italic">„{quote}”</span>
            {ranges.length > 0 && (
              <a href="#fragment" className="text-xs text-primary underline-offset-4 hover:underline">
                Przejdź do fragmentu
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Treść źródła</CardTitle>
          <CardDescription>Tekst zapisany w bazie w chwili pobrania — ten sam, który czytały reguły i model.</CardDescription>
        </CardHeader>
        <CardContent>
          {text ? (
            <div className="max-w-none font-mono text-xs leading-relaxed break-words whitespace-pre-wrap sm:text-[13px]">
              {chunks.map((chunk, i) => {
                if (!chunk.marked) return <span key={i}>{chunk.text}</span>;
                return (
                  <mark key={i} id={i === firstMark ? "fragment" : undefined} className="scroll-mt-24 rounded-sm bg-warning/30 px-0.5 text-foreground">
                    {chunk.text}
                  </mark>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Źródło nie ma zapisanej treści.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
