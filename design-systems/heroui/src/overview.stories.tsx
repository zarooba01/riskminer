import { Alert, Button, Card, Chip, Description, Input, Label, Switch, TextField } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";

const meta = { title: "Przegląd" } satisfies Meta;
export default meta;

/** Ten sam zestaw elementów co w „Porównaniu wariantów" głównego Storybooka. */
export const Komponenty: StoryObj = {
  render: () => (
    <div className="flex max-w-[520px] flex-col gap-5 p-6">
      <div>
        <p className="text-xs text-muted">HeroUI 3 (React Aria + Tailwind)</p>
        <h1 className="text-2xl font-semibold tracking-tight">HeroUI</h1>
        <p className="mt-1 text-sm text-muted">Zażółć gęślą jaźń — 0123456789</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">
          <PlusIcon className="size-4" /> Dodaj
        </Button>
        <Button variant="secondary">Drugi</Button>
        <Button variant="outline">Kontur</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Usuń</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip color="accent" variant="primary" size="sm">
          nowe
        </Chip>
        <Chip color="warning" variant="soft" size="sm">
          w toku
        </Chip>
        <Chip color="default" variant="secondary" size="sm">
          zamknięte
        </Chip>
        <Chip color="danger" variant="soft" size="sm">
          błąd
        </Chip>
        <Switch defaultSelected aria-label="Przykładowy przełącznik">
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Wszystkie", value: "1 284" },
          { label: "Użytkownicy", value: "128" },
        ].map((stat) => (
          <Card key={stat.label}>
            <Card.Content className="gap-1">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Karta z formularzem</Card.Title>
          <Card.Description>Pole, opis i akcja w jednym miejscu.</Card.Description>
        </Card.Header>
        <Card.Content className="items-start gap-4">
          <TextField name="email" type="email" fullWidth>
            <Label>E-mail</Label>
            <Input placeholder="jan@example.com" />
            <Description>Na ten adres wyślemy potwierdzenie.</Description>
          </TextField>
          <Button variant="primary">Zapisz</Button>
        </Card.Content>
      </Card>
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Nie udało się zapisać</Alert.Title>
          <Alert.Description>Sprawdź połączenie i spróbuj ponownie.</Alert.Description>
        </Alert.Content>
      </Alert>
    </div>
  ),
};
