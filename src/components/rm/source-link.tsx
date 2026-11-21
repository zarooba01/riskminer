import { ExternalLinkIcon, FileSearchIcon } from "lucide-react";
import Link from "next/link";

import { sourceViewHref } from "@/lib/rm/highlight";
import type { Source } from "@/lib/rm/types";

type Props = {
  source?: Source | null;
  label?: string;
  /** Cytat do zaznaczenia w podglądzie źródła. */
  quote?: string | null;
  /** Projekt, do którego wraca podgląd źródła. */
  projectId?: string | null;
};

/**
 * Odnośnik do źródła: podgląd w aplikacji (pełny tekst z zaznaczonym fragmentem) + oryginał
 * (e-Zamówienia, strona postępowania, plik). Każdy wniosek prowadzi do konkretnego fragmentu dokumentu.
 */
export function SourceLink({ source, label, quote, projectId }: Props) {
  if (!source) return <span className="text-xs text-muted-foreground">brak wskazanego źródła</span>;
  const text = label ?? source.external_id ?? source.title;
  const meta = `pobrano ${source.fetched_at.slice(0, 16).replace("T", " ")}`;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <Link href={sourceViewHref(source.id, quote, projectId)} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" title={meta}>
        <FileSearchIcon className="size-3" aria-hidden />
        {text}
        {quote ? " — pokaż fragment" : ""}
      </Link>
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-primary hover:underline" aria-label={`Oryginał: ${text}`}>
          oryginał <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      )}
      <span className="text-muted-foreground">· {meta}</span>
    </span>
  );
}
