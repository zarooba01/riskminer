import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, InfoIcon, MinusIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { AssessmentActionsMenu } from "@/components/rm/assessment-actions-menu";
import { AssessmentKindBadge } from "@/components/rm/assessment-kind-badge";
import { ItemDecision } from "@/components/rm/item-decision";
import { AssessmentItemRow, type ItemDecision as DecideFn } from "@/components/rm/assessment-item-row";
import { AssessmentParamsForm, type ParamsUpdate } from "@/components/rm/assessment-params-form";
import { Provenance } from "@/components/rm/provenance";
import { SourceLink } from "@/components/rm/source-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssessmentDetail } from "@/lib/assess/queries";
import type { AssessmentItem, AssessmentSummary, Distribution } from "@/lib/assess/types";
import { days, pct, pln, plnShort, type ActionResult } from "@/lib/rm/format";
import { cn } from "@/lib/utils";

type Props = {
  data: AssessmentDetail;
  model?: string;
  region?: string;
  rerun?: () => Promise<ActionResult>;
  saveParams?: (input: ParamsUpdate) => Promise<ActionResult>;
  decide?: DecideFn;
};

const num = (v: number | null | undefined, d = 1) => (v == null ? "—" : v.toLocaleString("pl-PL", { maximumFractionDigits: d }));
const range = (d: Distribution, fmt: (v: number | null) => string) => (d.n ? `${fmt(d.p25)} … ${fmt(d.p75)}` : "—");
const dayRound = (v: number | null) => days(v == null ? null : Math.round(v));
const len = (m: number | null) => (m == null ? "—" : m >= 1000 ? `${num(m / 1000, 2)} km` : `${m} m`);

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label} <Provenance kind="calc" />
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums", alert && "text-destructive")}>{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}


/** Ekran wyniku oceny nowej inwestycji: podsumowanie, podobne przypadki, porównanie, ryzyka, lista przed przetargiem, założenia. */
export function AssessmentDetailView({ data, model, region, rerun, saveParams, decide }: Props) {
  const { assessment, matches, items, sources, documents, catalog } = data;
  const s = assessment.summary as AssessmentSummary;
  const ready = Boolean(s?.generated_at);
  const projectTitles = Object.fromEntries(matches.map((m) => [m.project_id, m.project.title]));
  const included = matches.filter((m) => m.included);
  const flags = items.filter((i) => i.kind === "flag");
  const risks = items.filter((i) => i.kind === "risk");
  const aiItems = items.filter((i) => i.basis === "llm" && i.item_key.startsWith("ai:"));
  const gaps = items.filter((i) => i.kind === "gap");
  /** Zalecenia dla ryzyka bez duplikatów (katalog ekspercki + działania zapisane przy zdarzeniach; bez wniosków AI — te są osobno). */
  const isAi = assessment.mode === "ai";
  const guidance = (code: string | null, kind: AssessmentItem["kind"]) => [...new Set(items.filter((i) => i.risk_code === code && i.kind === kind && (isAi || !i.item_key.startsWith("ai:"))).map((i) => i.title))];
  const p = assessment.params;
  const prev = s?.previous;
  const catalogName = (code: string) => catalog.find((c) => c.code === code)?.name ?? code;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link href="/assessments">
          <ArrowLeftIcon aria-hidden /> Zapisane oceny
        </Link>
      </Button>
      <PageHeader
        title={assessment.title}
        description={assessment.description || "Ocena na podstawie dokumentu planu."}
        actions={<AssessmentActionsMenu assessmentId={assessment.id} rerun={rerun} />}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <AssessmentKindBadge ai={assessment.mode === "ai"} />
        <span>
          Wersja {assessment.version} · zaktualizowano {assessment.updated_at.slice(0, 16).replace("T", " ")}
        </span>
        {ready && (
          <span>
            Baza porównawcza: {s.corpus} zakończonych inwestycji
            {isAi && ` · ryzyka z AI do weryfikacji: ${risks.filter((i) => i.status === "proposed").length} z ${risks.length}`}
          </span>
        )}
        {documents.map((d) => (
          <SourceLink key={d.id} source={d} label={d.title} />
        ))}
      </p>

      {!ready ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Ocena nie została jeszcze przeliczona</AlertTitle>
          <AlertDescription>Otwórz menu „⋯” i wybierz „Zaktualizuj ocenę”, żeby dobrać podobne inwestycje.</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="summary" className="gap-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="summary">Podsumowanie</TabsTrigger>
            <TabsTrigger value="cases">Podobne inwestycje ({matches.length})</TabsTrigger>
            <TabsTrigger value="compare">Koszty i terminy</TabsTrigger>
            <TabsTrigger value="risks">Ryzyka i zalecenia ({risks.length})</TabsTrigger>
            <TabsTrigger value="params">Założenia</TabsTrigger>
          </TabsList>

          {/* 1. Podsumowanie */}
          <TabsContent value="summary" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label="Próba porównawcza"
                value={`${s.included} umów`}
                sub={`najbliższe z ${s.corpus} zakończonych inwestycji w bazie porównawczej · niepewność ${s.uncertainty}`}
                alert={s.uncertainty === "duża"}
              />
              <Kpi label="Zmiana kosztu (mediana)" value={pct(s.cost.median)} sub={`P25–P75: ${range(s.cost, (v) => pct(v))} · n=${s.cost.n}`} />
              <Kpi label="Opóźnienie (mediana)" value={dayRound(s.delay_days.median)} sub={`${pct(s.delay_pct.median)} pierwotnego terminu · P25–P75: ${range(s.delay_pct, (v) => pct(v))} · n=${s.delay_days.n}`} />
              <Kpi
                label="Umowy z aneksem"
                value={`${s.share_changed.k} z ${s.share_changed.n}`}
                sub={`koszt wzrósł: ${s.share_cost_increase.k}/${s.share_cost_increase.n} · po terminie: ${s.share_delayed.k}/${s.share_delayed.n}`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Prognoza dla planu <Provenance kind="calc" />
                </CardTitle>
                <CardDescription>{s.forecast.note}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Koszt po realizacji (budżet {plnShort(p.budget_pln)})</p>
                  {s.forecast.cost ? (
                    <p className="text-lg font-semibold tabular-nums">
                      {plnShort(s.forecast.cost.low)} – {plnShort(s.forecast.cost.high)}
                      <span className="block text-xs font-normal text-muted-foreground">mediana: {plnShort(s.forecast.cost.mid)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{p.budget_pln ? "za mała próba" : "podaj budżet w założeniach"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Czas realizacji (plan {p.duration_months ? `${num(p.duration_months, 0)} mies.` : "—"})</p>
                  {s.forecast.months ? (
                    <p className="text-lg font-semibold tabular-nums">
                      {num(s.forecast.months.low)} – {num(s.forecast.months.high)} mies.
                      <span className="block text-xs font-normal text-muted-foreground">mediana: {num(s.forecast.months.mid)} mies.</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{p.duration_months ? "za mała próba" : "podaj czas realizacji w założeniach"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Koszt wg ceny 1 km w podobnych umowach ({len(p.length_m)})</p>
                  {s.forecast.by_length ? (
                    <p className="text-lg font-semibold tabular-nums">
                      {plnShort(s.forecast.by_length)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        mediana {plnShort(s.cost_per_km.median)}/km · n={s.cost_per_km.n}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{p.length_m ? `za mało umów ze znaną długością (n=${s.cost_per_km.n})` : "podaj długość sieci"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {prev && (
              <Card>
                <CardHeader>
                  <CardTitle>Co się zmieniło od wersji {prev.version}</CardTitle>
                  <CardDescription>Porównanie z poprzednim przeliczeniem ({prev.generated_at.slice(0, 16).replace("T", " ")}).</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p>
                    Próba: {prev.included} → {s.included} umów · mediana kosztu: {pct(prev.cost.median)} → {pct(s.cost.median)} · mediana opóźnienia: {dayRound(prev.delay_days.median)} → {dayRound(s.delay_days.median)}
                  </p>
                  {(() => {
                    const now = included.map((m) => m.project_id);
                    const added = now.filter((id) => !prev.project_ids.includes(id));
                    const removed = prev.project_ids.filter((id) => !now.includes(id));
                    const newRisks = risks.map((r) => r.risk_code!).filter((c) => !prev.risk_codes.includes(c));
                    return (
                      <p className="text-muted-foreground">
                        Nowe przypadki: {added.join(", ") || "brak"} · usunięte: {removed.join(", ") || "brak"} · nowe ryzyka: {newRisks.join(", ") || "brak"}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Czerwone flagi</CardTitle>
                <CardDescription>Obliczone na podobnych umowach — każda z liczebnością próby i listą przypadków.</CardDescription>
              </CardHeader>
              <CardContent>
                {flags.length ? (
                  <ul className="flex flex-col">
                    {flags.map((item) => (
                      <AssessmentItemRow key={item.id} item={item} sources={sources} projectTitles={projectTitles} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Brak flag — za mała próba albo odchylenia w normie.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Najczęstsze ryzyka w podobnych inwestycjach</CardTitle>
                <CardDescription>Szczegóły, cytaty ze źródeł i zalecenia — w zakładce „Ryzyka i zalecenia”.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {risks.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <Badge variant="outline" className="w-12 justify-center font-mono">
                        {r.risk_code}
                      </Badge>
                      <span className="flex-1 text-sm">{catalogName(r.risk_code ?? "")}</span>
                      <span className="flex items-center gap-2 sm:w-64">
                        <Progress value={r.n_total ? ((r.n_cases ?? 0) / r.n_total) * 100 : 0} className="h-1.5" aria-label={`${r.risk_code}: ${r.n_cases} z ${r.n_total}`} />
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {r.n_cases}/{r.n_total}
                        </span>
                      </span>
                      {r.basis === "input" && <Badge variant="secondary">z opisu planu</Badge>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Podobne inwestycje */}
          <TabsContent value="cases" className="flex flex-col gap-4">
            <Alert>
              <InfoIcon />
              <AlertDescription>
                {isAi ? (
                  <>
                    <strong>Przypadki wybrał model AI</strong> z bazy porównawczej; wynik (0–100) i powody podobieństwa to ocena modelu. Liczby kosztów i terminów są z ogłoszeń
                    BZP tych przypadków, a statystyka to obliczenia.
                  </>
                ) : (
                  <>
                <strong>Podobieństwo jest zawsze liczone deterministycznie (bez AI):</strong> ten sam opis i ta sama baza dają zawsze ten sam wynik. Podobieństwo opisu (0–100) łączy dane
                strukturalne (podsektor, rodzaj robót, skala, województwo) z treścią opisów — tytułu i opisu przedmiotu zamówienia z ogłoszenia BZP. Rozwiń „Wkład cech”, żeby
                zobaczyć punkty każdej cechy. Do statystyki kosztów i terminów wchodzą tylko przypadki z dopasowaniem do BZP zatwierdzonym przez eksperta i danymi o wykonaniu
                umowy — pozostałe są oznaczone „poza statystyką” z powodem.
                  </>
                )}
              </AlertDescription>
            </Alert>
            <Card>
              <CardContent className="pt-6">
                <ul className="flex flex-col">
                  {matches.map((m) => (
                    <li key={m.id} className={cn("border-b py-3 last:border-0", !m.included && "opacity-75")}>
                      <Collapsible>
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
                          <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{m.rank}.</span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <Link href={`/projects/${encodeURIComponent(m.project_id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                              {m.project_id}: {m.project.title}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {m.project.beneficiary_name} · {m.project.province ?? "—"} · {m.project.subsector_main ?? "—"} · {m.project.works_type ?? "—"}
                            </span>
                            <span className="text-sm">
                              <span className="text-muted-foreground">Dlaczego podobne: </span>
                              {m.reasons.length ? m.reasons.join(" · ") : "słabe podobieństwo"}
                            </span>
                            {m.project.notice_source_id && <SourceLink source={sources[m.project.notice_source_id]} label="Ogłoszenie o zamówieniu (opis przedmiotu)" projectId={m.project_id} />}
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5 md:w-56">
                            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              Podobieństwo opisu
                            </span>
                            <span className="flex items-center gap-2">
                              <Progress value={m.score} className="h-2" aria-label={`Podobieństwo opisu ${m.score} na 100`} />
                              <span className="w-10 text-right text-sm font-semibold tabular-nums">{num(m.score, 0)}</span>
                            </span>
                            <span className="flex flex-wrap gap-1">
                              {m.included ? (
                                <Badge variant="outline" className="gap-1">
                                  <CheckIcon className="size-3" aria-hidden /> w statystyce
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  <MinusIcon className="size-3" aria-hidden /> poza statystyką
                                </Badge>
                              )}
                            </span>
                            {m.excluded_reason && <span className="text-xs text-muted-foreground">{m.excluded_reason}</span>}
                            {m.components.length > 0 && (
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="self-start px-0">
                                  Wkład cech <ChevronDownIcon aria-hidden />
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </div>
                        </div>
                        <CollapsibleContent>
                          <Table className="mt-2">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cecha</TableHead>
                                <TableHead className="text-right">Waga</TableHead>
                                <TableHead className="text-right">Zgodność</TableHead>
                                <TableHead className="text-right">Punkty</TableHead>
                                <TableHead>Szczegół</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {m.components.map((c) => (
                                <TableRow key={c.feature} className={cn(!c.applicable && "text-muted-foreground")}>
                                  <TableCell>{c.label}</TableCell>
                                  <TableCell className="text-right tabular-nums">{c.weight}</TableCell>
                                  <TableCell className="text-right tabular-nums">{c.applicable ? `${Math.round(c.value * 100)}%` : "nie dotyczy"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{num(c.points)}</TableCell>
                                  <TableCell className="text-xs">{c.detail}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Koszty i terminy */}
          <TabsContent value="compare" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Jak zmieniały się koszty i terminy w podobnych umowach <Provenance kind="source" /> <Provenance kind="calc" />
                </CardTitle>
                <CardDescription>
                  Umowy z próby porównawczej. Wartości z ogłoszeń BZP (wynik postępowania, zmiany i wykonanie umowy), odchylenia to obliczenia. Kwoty brutto. Mediany i przedziały — w zakładce „Podsumowanie”.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Przypadek</TableHead>
                      <TableHead className="text-right">Wartość umowy</TableHead>
                      <TableHead className="text-right">Wypłacono</TableHead>
                      <TableHead className="text-right">Zmiana kosztu</TableHead>
                      <TableHead className="text-right">Okres (mies.)</TableHead>
                      <TableHead className="text-right">Opóźnienie</TableHead>
                      <TableHead className="text-right">Oferty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {included.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link href={`/projects/${encodeURIComponent(m.project_id)}`} className="text-primary underline-offset-4 hover:underline" title={m.project.title}>
                            {m.project_id}
                          </Link>
                          <span className="block max-w-xs truncate text-xs text-muted-foreground">{m.project.title}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pln(m.initial_value)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pln(m.paid_total)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", (m.cost_deviation_pct ?? 0) > 10 && "text-destructive")}>{pct(m.cost_deviation_pct)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(m.initial_months)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", (m.delay_days ?? 0) > 60 && "text-destructive")}>{days(m.delay_days)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.offers_count ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. Ryzyka i zalecenia */}
          <TabsContent value="risks" className="flex flex-col gap-4">
            {(s.detected.length > 0 || gaps.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Do lokalnego potwierdzenia <Provenance kind={isAi ? "llm" : "input"} />
                  </CardTitle>
                  <CardDescription>
                    {isAi
                      ? "Kwestie zaproponowane przez model na podstawie opisu planu — do potwierdzenia na miejscu."
                      : "Kwestie wskazane w opisie planu i tematy, o których opis nie wspomina (wg poradnika eksperckiego)."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                    {s.detected.map((d) => (
                      <li key={d.code}>
                        <span className="font-medium">{catalogName(d.code)}</span> — w opisie: „{d.terms.join("”, „")}”
                      </li>
                    ))}
                    {gaps.map((g) => (
                      <li key={g.id}>
                        <span className="font-medium">{g.title}</span>
                        {g.body && <span className="text-muted-foreground"> — {g.body}</span>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {risks.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Brak ryzyk</EmptyTitle>
                  <EmptyDescription>W podobnych przypadkach nie ma udokumentowanych zdarzeń, a opis nie wskazuje warunków lokalnych.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {risks.map((risk) => {
              const examples = risk.support?.examples ?? [];
              const groups = [
                ["Sprawdź przed przetargiem", guidance(risk.risk_code, "check")],
                ["Działania", guidance(risk.risk_code, "action")],
                ["Zapisy umowne", guidance(risk.risk_code, "clause")],
              ] as const;
              return (
                <Card key={risk.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {risk.risk_code}
                      </Badge>
                      {catalogName(risk.risk_code ?? "")}
                      <Provenance kind={risk.basis === "llm" ? "llm" : risk.basis === "input" ? "input" : "source"} />
                      {risk.basis === "llm" && decide && <ItemDecision id={risk.id} status={risk.status} decide={decide} />}
                    </CardTitle>
                    <CardDescription>
                      {risk.n_cases ? `Wystąpiło w ${risk.n_cases} z ${risk.n_total} podobnych umów. ` : isAi && risk.n_total ? `W umowach z próby brak zdarzeń tego typu (0 z ${risk.n_total}). ` : ""}
                      {risk.body}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      {groups.map(([title, list]) => (
                        <section key={title} className="flex flex-col gap-1.5">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{title}</h4>
                          {list.length ? (
                            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                              {list.map((text) => (
                                <li key={text}>{text}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">Brak w katalogu (Weryfikacja → Katalog).</p>
                          )}
                        </section>
                      ))}
                    </div>
                    {examples.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="px-0">
                            Pokaż źródła ({examples.length}) <ChevronDownIcon aria-hidden />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="flex flex-col gap-3 pt-2">
                          {examples.map((ex, i) => (
                            <figure key={`${ex.source_id}-${i}`} className="flex flex-col gap-1 rounded-lg bg-muted/30 p-3">
                              <figcaption className="text-xs font-medium">
                                <Link href={`/projects/${encodeURIComponent(ex.project_id)}`} className="text-primary underline-offset-4 hover:underline">
                                  {ex.project_id}
                                </Link>
                                {ex.label ? `: ${ex.label}` : ""}
                              </figcaption>
                              {ex.quote && <blockquote className="text-sm italic">„{ex.quote}”</blockquote>}
                              <SourceLink source={ex.source_id ? sources[ex.source_id] : null} quote={ex.quote} projectId={ex.project_id} />
                            </figure>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {!isAi && aiItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Wnioski modelu AI <Provenance kind="llm" />
                  </CardTitle>
                  <CardDescription>Do decyzji eksperta. Każdy wniosek wskazuje przypadki lub zdarzenia, na których się opiera; wnioski bez oparcia zostały odrzucone automatycznie.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col">
                    {aiItems.map((item) => (
                      <AssessmentItemRow key={item.id} item={item} sources={sources} projectTitles={projectTitles} decide={decide} showKind />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 5. Założenia */}
          <TabsContent value="params" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Założenia oceny</CardTitle>
                <CardDescription>
                  {isAi
                    ? "Popraw parametry i przelicz — model uwzględni je jako ustalone; decyzje eksperta o wnioskach zostaną zachowane."
                    : "Zmień parametry lub wagi i przelicz — decyzje eksperta o pozycjach zostaną zachowane."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AssessmentParamsForm key={assessment.version} params={p} origin={assessment.params_origin} save={saveParams} showWeights={!isAi} />
              </CardContent>
            </Card>
            {isAi && model && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SparklesIcon className="size-4" aria-hidden /> Ocena AI
                  </CardTitle>
                  <CardDescription>
                    Model <span className="font-mono">{model}</span>, przetwarzanie: {region}. Do modelu trafia opis planu, fragment dokumentu planu i dane bazy porównawczej
                    (publiczne ogłoszenia). Model wybiera przypadki i formułuje wnioski — każdy musi wskazywać przypadek lub zdarzenie; mediany i przedziały liczymy z danych.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
