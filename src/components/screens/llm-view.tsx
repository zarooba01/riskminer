import { BotIcon, CoinsIcon, LogInIcon, LogOutIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usd } from "@/lib/rm/format";

export type ModelInfo = {
  id: string;
  region: string;
  /** Cena za 1M tokenów (wejście / wyjście) z cennika AI Gateway albo „cena nieznana”. */
  price: string;
  production: boolean;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  lastUsedAt: string | null;
};

type Props = {
  models: ModelInfo[];
  productionModel: string;
};

const tokens = (v: number) => v.toLocaleString("pl-PL");
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }) : "—";

/** Modele AI: konfiguracja, region przetwarzania, cennik i faktyczne zużycie (tokeny, koszt w USD) z rejestru wywołań. */
export function LlmView({ models, productionModel }: Props) {
  const total = models.reduce(
    (acc, m) => ({ calls: acc.calls + m.calls, tokensIn: acc.tokensIn + m.tokensIn, tokensOut: acc.tokensOut + m.tokensOut, costUsd: acc.costUsd + m.costUsd }),
    { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 },
  );

  return (
    <>
      <PageHeader
        title="Modele"
        description={`Modele AI dostępne przez Vercel AI Gateway, ich cennik i zużycie. Model produkcyjny: ${productionModel} (zmiana w zmiennej LLM_MODEL, bez zmian w kodzie).`}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Wywołania AI" value={tokens(total.calls)} icon={BotIcon} hint="łącznie, wszystkie modele" />
        <StatCard label="Tokeny wejściowe" value={tokens(total.tokensIn)} icon={LogInIcon} hint="wysłane do modeli" />
        <StatCard label="Tokeny wyjściowe" value={tokens(total.tokensOut)} icon={LogOutIcon} hint="wygenerowane przez modele" />
        <StatCard label="Koszt łącznie" value={usd(total.costUsd)} icon={CoinsIcon} hint="wg AI Gateway lub cennika" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Modele i zużycie</CardTitle>
          <CardDescription>
            Cena za 1 mln tokenów (wejście / wyjście) z cennika AI Gateway. Zużycie z rejestru wywołań — wyniki z pamięci podręcznej nie są liczone
            ponownie.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Cena za 1M tok.</TableHead>
                <TableHead className="text-right">Wywołania</TableHead>
                <TableHead className="text-right">Tokeny wejściowe</TableHead>
                <TableHead className="text-right">Tokeny wyjściowe</TableHead>
                <TableHead className="text-right">Koszt</TableHead>
                <TableHead className="text-right">Ostatnie użycie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{m.id}</span>
                      {m.production && <Badge>produkcyjny</Badge>}
                    </span>
                    <p className="text-xs text-muted-foreground">{m.region}</p>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{m.price}</TableCell>
                  <TableCell className="text-right tabular-nums">{tokens(m.calls)}</TableCell>
                  <TableCell className="text-right tabular-nums">{tokens(m.tokensIn)}</TableCell>
                  <TableCell className="text-right tabular-nums">{tokens(m.tokensOut)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(m.costUsd)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{dateTime(m.lastUsedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Razem
                </TableCell>
                <TableCell className="text-right tabular-nums">{tokens(total.calls)}</TableCell>
                <TableCell className="text-right tabular-nums">{tokens(total.tokensIn)}</TableCell>
                <TableCell className="text-right tabular-nums">{tokens(total.tokensOut)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(total.costUsd)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
