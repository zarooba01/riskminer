"use client";

import { CheckIcon, ExternalLinkIcon, FileTextIcon, QuoteIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/rm/format";
import { sourceViewHref } from "@/lib/rm/highlight";
import type { DocumentFinding, ProjectDocument } from "@/lib/rm/types";
import { cn } from "@/lib/utils";

type DecideFinding = (id: string, decision: "accept" | "reject" | "reopen") => Promise<ActionResult>;

const groups: { kind: DocumentFinding["kind"]; title: string; dot: string }[] = [
  { kind: "conflicts", title: "Rozbieżności z danymi z BZP", dot: "bg-destructive" },
  { kind: "adds", title: "Uzupełnia", dot: "bg-warning" },
  { kind: "confirms", title: "Potwierdza", dot: "bg-success" },
];

function FindingRow({ finding, decide, sourceId, projectId }: { finding: DocumentFinding; decide?: DecideFinding; sourceId?: string | null; projectId?: string }) {
  const [pending, start] = useTransition();
  const run = (decision: "accept" | "reject" | "reopen") =>
    start(async () => {
      const r = await decide!(finding.id, decision);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  return (
    <li className={cn("flex flex-col gap-1 border-b py-2 last:border-0", finding.status === "rejected" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <Badge variant="outline" className="mt-0.5 shrink-0">
          {finding.topic}
        </Badge>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm">{finding.statement}</p>
          {(finding.doc_value || finding.current_value) && (
            <p className="text-xs text-muted-foreground">
              {finding.doc_value && <>dokument: <span className="text-foreground">{finding.doc_value}</span></>}
              {finding.doc_value && finding.current_value && " · "}
              {finding.current_value && <>dane z BZP: <span className="text-foreground">{finding.current_value}</span></>}
            </p>
          )}
          {finding.quote && (
            <p className="flex gap-1.5 text-xs text-muted-foreground italic">
              <QuoteIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                {finding.quote}
                <span className="not-italic">
                  {finding.page != null && ` — str. ${finding.page}`}
                  {finding.quote_verified === false && <span className="text-destructive"> (cytatu nie znaleziono)</span>}
                  {sourceId && (
                    <>
                      {" · "}
                      <Link href={sourceViewHref(sourceId, finding.quote, projectId)} className="text-primary underline-offset-4 hover:underline">
                        pokaż fragment
                      </Link>
                    </>
                  )}
                </span>
              </span>
            </p>
          )}
        </div>
        {decide && (
          <span className="flex shrink-0 items-center gap-1">
            {finding.status === "proposed" ? (
              <>
                <Button size="icon" variant="ghost" className="size-8 text-success" disabled={pending} onClick={() => run("accept")} aria-label="Zatwierdź ustalenie">
                  <CheckIcon />
                </Button>
                <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={pending} onClick={() => run("reject")} aria-label="Odrzuć ustalenie">
                  <XIcon />
                </Button>
              </>
            ) : (
              <>
                <span className={cn("text-xs", finding.status === "accepted" ? "text-success" : "text-muted-foreground")}>{finding.status === "accepted" ? "zatwierdzone" : "odrzucone"}</span>
                <Button size="icon" variant="ghost" className="size-8" disabled={pending} onClick={() => run("reopen")} aria-label="Przywróć do weryfikacji">
                  <RotateCcwIcon />
                </Button>
              </>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

/** Karta dokumentu eksperta: plik, podsumowanie, ustalenia w grupach i ponowna analiza. */
export function DocumentCard({ document, projectId, decide }: { document: ProjectDocument & { findings: DocumentFinding[] }; projectId: string; decide?: DecideFinding }) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);

  const reanalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/documents/${document.id}/analyze`, { method: "POST" });
      const r = await response.json();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      router.refresh();
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium break-all">
              {document.download_url ? (
                <a href={document.download_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {document.file_name} <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                document.file_name
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {document.doc_type} · {document.pages ?? "?"} {document.file_name.toLowerCase().endsWith(".pdf") ? "str." : "fragm."} · dodano {document.created_at.slice(0, 16).replace("T", " ")}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={reanalyze} disabled={analyzing}>
          {analyzing ? <Spinner /> : <RefreshCwIcon />} Analizuj ponownie
        </Button>
      </div>

      {document.status === "error" && <p className="text-sm text-destructive">Analiza nie powiodła się: {document.error}</p>}
      {document.summary && <p className="text-sm">{document.summary}</p>}

      {groups.map((g) => {
        const items = document.findings.filter((f) => f.kind === g.kind);
        if (!items.length) return null;
        return (
          <div key={g.kind} className="flex flex-col">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <span className={cn("size-2 rounded-full", g.dot)} aria-hidden /> {g.title} ({items.length})
            </h4>
            <ul className="flex flex-col">
              {items.map((f) => (
                <FindingRow key={f.id} finding={f} decide={decide} sourceId={document.source_id} projectId={document.project_id} />
              ))}
            </ul>
          </div>
        );
      })}
      {document.status === "analyzed" && !document.findings.length && <p className="text-sm text-muted-foreground">Model nie znalazł ustaleń względem danych sprawy.</p>}
    </section>
  );
}
