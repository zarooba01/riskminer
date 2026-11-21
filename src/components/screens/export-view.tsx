import { DownloadIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { entities: { key: string; label: string; count: number | null }[] };

export function ExportView({ entities }: Props) {
  return (
    <>
      <PageHeader
        title="Eksport"
        description="Wszystkie wyniki są rekordami w bazie — do filtrowania, aktualizacji i dalszej pracy. CSV (UTF-8 z BOM, otwiera się w Excelu) lub JSON."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entities.map((e) => (
          <Card key={e.key}>
            <CardHeader>
              <CardTitle className="text-base">{e.label}</CardTitle>
              <CardDescription>
                <span className="font-mono">{e.key}</span>
                {e.count != null && ` · ${e.count} rekordów`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/export/${e.key}?format=csv`}>
                  <DownloadIcon /> CSV
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/export/${e.key}?format=json`}>
                  <DownloadIcon /> JSON
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
