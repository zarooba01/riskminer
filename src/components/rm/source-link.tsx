import { ExternalLinkIcon } from "lucide-react";

import type { Source } from "@/lib/rm/types";

/** Odnośnik do źródła z identyfikatorem i datą pobrania — każdy wniosek prowadzi do dokumentu. */
export function SourceLink({ source, label }: { source?: Source | null; label?: string }) {
  if (!source) return <span className="text-xs text-muted-foreground">brak wskazanego źródła</span>;
  const text = label ?? source.external_id ?? source.title;
  const meta = `pobrano ${source.fetched_at.slice(0, 16).replace("T", " ")}`;
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline" title={meta}>
      {text} <ExternalLinkIcon className="size-3" aria-hidden />
      <span className="text-muted-foreground no-underline">· {meta}</span>
    </a>
  ) : (
    <span className="text-xs text-muted-foreground">
      {text} · {meta}
    </span>
  );
}
