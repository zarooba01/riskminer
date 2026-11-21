import type { Meta, StoryObj } from "@storybook/react-vite";

import { sampleNavigation, sampleRecords, sampleUser } from "@sample-data";
import { phone } from "@shared/storybook";

import { BaseLayout, BasePagePlaceholder } from "./screens/base-layout";
import { DashboardScreen } from "./screens/dashboard";
import { LoginScreen } from "./screens/login";
import { RecordsListScreen } from "./screens/records-list";

const meta = { title: "Makiety" } satisfies Meta;
export default meta;
type Story = StoryObj;

const shell = { navigation: sampleNavigation, user: sampleUser, notifications: 4 };

export const Logowanie: Story = { render: () => <LoginScreen /> };
export const LogowanieTelefon: Story = { ...Logowanie, ...phone, name: "Logowanie (telefon)" };

export const StronaBazowa: Story = {
  name: "Strona bazowa",
  render: () => (
    <BaseLayout {...shell}>
      <BasePagePlaceholder />
    </BaseLayout>
  ),
};
export const StronaBazowaTelefon: Story = { ...StronaBazowa, ...phone, name: "Strona bazowa (telefon)" };

export const Pulpit: Story = {
  render: () => (
    <BaseLayout {...shell}>
      <DashboardScreen userName="Anna" records={sampleRecords} />
    </BaseLayout>
  ),
};
export const PulpitTelefon: Story = { ...Pulpit, ...phone, name: "Pulpit (telefon)" };

export const Lista: Story = {
  render: () => (
    <BaseLayout {...shell} activeHref="/records">
      <RecordsListScreen records={sampleRecords} />
    </BaseLayout>
  ),
};
export const ListaTelefon: Story = { ...Lista, ...phone, name: "Lista (telefon)" };
