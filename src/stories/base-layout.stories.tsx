import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { BaseLayout } from "@/components/layout/base-layout";
import { BasePageView } from "@/components/screens/base-page-view";
import { ProjectsListView } from "@/components/screens/projects-list-view";
import { sampleNavigation, sampleUser } from "@/lib/sample-data";

import { phone } from "./helpers";
import { sampleProjects } from "./rm-sample";

const meta = {
  title: "Makiety/Strona bazowa",
  component: BaseLayout,
  parameters: { layout: "fullscreen", nextjs: { navigation: { pathname: "/dashboard" } } },
  args: {
    navigation: sampleNavigation,
    user: sampleUser,
    notifications: 4,
    children: <BasePageView />,
  },
} satisfies Meta<typeof BaseLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nagłówek z logo, wyszukiwarką i menu użytkownika; pod nim lewy panel nawigacyjny i strefy treści. */
export const Pusta: Story = {};

/** Panel zwinięty do ikon — tak samo jak po kliknięciu przycisku menu w nagłówku. */
export const PanelZwiniety: Story = {
  name: "Panel zwinięty",
  args: { defaultOpen: false },
};

/** Ta sama rama z prawdziwym ekranem w środku. */
export const ZTrescia: Story = {
  name: "Z treścią (lista)",
  parameters: { nextjs: { navigation: { pathname: "/records" } } },
  args: { children: <ProjectsListView projects={sampleProjects} /> },
};

/** Na telefonie panel jest schowany; otwiera go przycisk menu w nagłówku. */
export const Telefon: Story = { ...phone };

export const TelefonMenu: Story = {
  ...phone,
  name: "Telefon — otwarte menu",
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Pokaż lub ukryj menu" }));
    await expect(await within(document.body).findByRole("link", { name: /Rekordy/ })).toBeVisible();
  },
};
