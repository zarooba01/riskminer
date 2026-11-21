import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InboxIcon, PlusIcon } from "lucide-react";

import ErrorPage from "@/app/error";
import Loading from "@/app/(app)/loading";
import NotFound from "@/app/not-found";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const meta = {
  title: "Wzorce/Stany",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Szkielet pokazywany, gdy strona chroniona czeka na dane (`loading.tsx`). */
export const Ladowanie: Story = {
  name: "Ładowanie",
  render: () => (
    <div className="p-6">
      <Loading />
    </div>
  ),
};

/** Pusta lista zawsze mówi, co zrobić dalej. */
export const Pusto: Story = {
  render: () => (
    <div className="p-6">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Nie ma jeszcze rekordów</EmptyTitle>
          <EmptyDescription>Dodaj pierwszy rekord, żeby zacząć.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>
            <PlusIcon /> Dodaj rekord
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
};

export const Blad: Story = {
  name: "Błąd",
  render: () => <ErrorPage error={new Error("Przykład")} reset={() => {}} />,
};

export const NieZnaleziono: Story = {
  name: "Nie znaleziono (404)",
  render: () => <NotFound />,
};
