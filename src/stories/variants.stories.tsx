import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AlertCircleIcon, InboxIcon, PlusIcon, UsersIcon } from "lucide-react";

import { StatCard } from "@/components/layout/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { themes } from "@/lib/themes";

const meta = {
  title: "Fundamenty/Porównanie wariantów",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ten sam zestaw elementów w jednym wariancie — `data-theme` na opakowaniu przełącza wszystkie tokeny. */
function Sample({ themeId, label }: { themeId: string; label: string }) {
  return (
    <section data-theme={themeId} className="flex flex-col gap-5 bg-background p-6 font-sans text-foreground">
      <header>
        <p className="font-mono text-xs text-muted-foreground">data-theme=&quot;{themeId}&quot;</p>
        <h2 className="text-2xl font-semibold tracking-tight">{label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Zażółć gęślą jaźń — 0123456789</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button>
          <PlusIcon /> Dodaj
        </Button>
        <Button variant="secondary">Drugi</Button>
        <Button variant="outline">Kontur</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Usuń</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>nowe</Badge>
        <Badge variant="secondary">w toku</Badge>
        <Badge variant="outline">zamknięte</Badge>
        <Badge variant="destructive">błąd</Badge>
        <Switch defaultChecked aria-label="Przykładowy przełącznik" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Wszystkie" value="1 284" icon={InboxIcon} change="+12%" trend="up" hint="m/m" />
        <StatCard label="Użytkownicy" value="128" icon={UsersIcon} change="-3%" trend="down" hint="m/m" />
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Karta z formularzem</CardTitle>
          <CardDescription>Pole, opis i akcja w jednym miejscu.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={`email-${themeId}`}>E-mail</FieldLabel>
            <Input id={`email-${themeId}`} type="email" placeholder="jan@example.com" />
            <FieldDescription>Na ten adres wyślemy potwierdzenie.</FieldDescription>
          </Field>
          <Button className="self-start">Zapisz</Button>
        </CardContent>
      </Card>

      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Nie udało się zapisać</AlertTitle>
        <AlertDescription>Sprawdź połączenie i spróbuj ponownie.</AlertDescription>
      </Alert>
    </section>
  );
}

/**
 * Wszystkie warianty obok siebie. Przełącznik Jasny/Ciemny na pasku narzędzi działa na całość;
 * przełącznik „Wariant” nie ma tu znaczenia, bo każda kolumna ma własny `data-theme`.
 */
export const ObokSiebie: Story = {
  name: "Obok siebie",
  render: () => (
    <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      {themes.map((theme) => (
        <Sample key={theme.id} themeId={theme.id} label={theme.label} />
      ))}
    </div>
  ),
};
