import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InboxIcon, PlusIcon, UsersIcon } from "lucide-react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Logo } from "@/components/layout/logo";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

import { phone } from "./helpers";

const meta = {
  title: "Komponenty/Układ",
  parameters: { nextjs: { navigation: { pathname: "/dashboard" } } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tytuł strony z opisem i akcjami. Na telefonie akcje przechodzą pod tytuł. */
export const NaglowekStrony: Story = {
  name: "Nagłówek strony",
  render: () => (
    <div className="p-6">
      <PageHeader
        title="Rekordy"
        description="Lista wszystkich zgłoszeń."
        actions={
          <>
            <Button variant="outline">Eksport</Button>
            <Button>
              <PlusIcon /> Dodaj
            </Button>
          </>
        }
      />
    </div>
  ),
};

/** Kafelek liczby na pulpicie; trend i ikona są opcjonalne. */
export const KafelkiStatystyk: Story = {
  name: "Kafelki statystyk",
  render: () => (
    <div className="grid max-w-3xl grid-cols-2 gap-4 p-6 lg:grid-cols-3">
      <StatCard label="Wszystkie" value="1 284" icon={InboxIcon} change="+12%" trend="up" hint="m/m" />
      <StatCard label="Użytkownicy" value="128" icon={UsersIcon} change="-3%" trend="down" hint="m/m" />
      <StatCard label="Średni czas" value="2 dni" />
    </div>
  ),
};

/** Dolna nawigacja jest widoczna tylko poniżej breakpointu `md` — oglądaj na viewporcie „Telefon”. */
export const DolnaNawigacja: Story = {
  name: "Dolna nawigacja",
  ...phone,
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="h-64">
      <p className="p-4 text-sm text-muted-foreground">Pozycje pochodzą z `navItems` w src/lib/config.ts.</p>
      <BottomNav />
    </div>
  ),
};

export const LogoIMotyw: Story = {
  name: "Logo i przełącznik motywu",
  render: () => (
    <div className="flex items-center gap-6 p-6">
      <Logo />
      <Logo hideName />
      <ThemeToggle />
    </div>
  ),
};
