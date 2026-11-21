import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle1,
  Switch,
  Text,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Przegląd" } satisfies Meta;
export default meta;

const row = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS } as const;

/** Ten sam zestaw elementów co w „Porównaniu wariantów" głównego Storybooka. */
export const Komponenty: StoryObj = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL, padding: 24, maxWidth: 520 }}>
      <div>
        <Caption1 block style={{ color: tokens.colorNeutralForeground3 }}>
          Microsoft Fluent 2
        </Caption1>
        <Title1 as="h1" block>
          Fluent UI
        </Title1>
        <Body1 style={{ color: tokens.colorNeutralForeground3 }}>Zażółć gęślą jaźń — 0123456789</Body1>
      </div>
      <div style={row}>
        <Button appearance="primary" icon={<Add20Regular />}>
          Dodaj
        </Button>
        <Button>Drugi</Button>
        <Button appearance="outline">Kontur</Button>
        <Button appearance="subtle">Subtelny</Button>
        <Button appearance="primary" style={{ backgroundColor: tokens.colorStatusDangerBackground3 }}>
          Usuń
        </Button>
      </div>
      <div style={row}>
        <Badge color="brand">nowe</Badge>
        <Badge color="warning" appearance="tint">
          w toku
        </Badge>
        <Badge color="informative" appearance="outline">
          zamknięte
        </Badge>
        <Badge color="danger">błąd</Badge>
        <Switch defaultChecked aria-label="Przykładowy przełącznik" />
      </div>
      <div style={{ display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[
          { label: "Wszystkie", value: "1 284" },
          { label: "Użytkownicy", value: "128" },
        ].map((stat) => (
          <Card key={stat.label}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{stat.label}</Caption1>
            <Text size={800} weight="semibold">
              {stat.value}
            </Text>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader
          header={<Subtitle1>Karta z formularzem</Subtitle1>}
          description={<Caption1>Pole, opis i akcja w jednym miejscu.</Caption1>}
        />
        <Field label="E-mail" hint="Na ten adres wyślemy potwierdzenie.">
          <Input type="email" placeholder="jan@example.com" />
        </Field>
        <div>
          <Button appearance="primary">Zapisz</Button>
        </div>
      </Card>
      <MessageBar intent="error">
        <MessageBarBody>
          <MessageBarTitle>Nie udało się zapisać</MessageBarTitle>
          Sprawdź połączenie i spróbuj ponownie.
        </MessageBarBody>
      </MessageBar>
    </div>
  ),
};
