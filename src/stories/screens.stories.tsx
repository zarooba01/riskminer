import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/components/screens/dashboard-view";
import { ExportView } from "@/components/screens/export-view";
import { LlmView } from "@/components/screens/llm-view";
import { ProjectDetailView } from "@/components/screens/project-detail-view";
import { ProjectsListView } from "@/components/screens/projects-list-view";
import { ReviewView } from "@/components/screens/review-view";
import { Toaster } from "@/components/ui/sonner";

import { demoUser, fakeResult, phone } from "./helpers";
import { sampleCatalog, sampleDetail, sampleProjects, sampleReview } from "./rm-sample";

const path = (pathname: string) => ({ nextjs: { navigation: { pathname } } });

const meta = {
  title: "Makiety/Risk Miner",
  parameters: { layout: "fullscreen", ...path("/dashboard") },
  decorators: [
    (Story) => (
      <AppShell user={demoUser}>
        <Story />
        <Toaster position="top-center" />
      </AppShell>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const eventActions = { decide: fakeResult(), edit: fakeResult(), exemplary: fakeResult() };

export const Pulpit: Story = {
  render: () => (
    <DashboardView
      stats={{ projects: 22, enriched: 18, notices: 61, contracts: 15, proposed: 43, accepted: 12, runs: 9, costUsd: 0.0731 }}
      model="anthropic/claude-haiku-5.5"
      projectIds={sampleProjects.map((p) => p.id)}
      importAction={fakeResult("Zaimportowano 22 projekty.")}
      enrichAction={fakeResult("RM-2026-001: ogłoszeń 3, zdarzeń 4.")}
    />
  ),
};
export const PulpitTelefon: Story = { ...Pulpit, ...phone, name: "Pulpit (telefon)" };

export const Projekty: Story = {
  parameters: path("/projects"),
  render: () => <ProjectsListView projects={sampleProjects} />,
};
export const ProjektyTelefon: Story = { ...Projekty, ...phone, name: "Projekty (telefon)" };

export const Projekt: Story = {
  parameters: path("/projects/RM-2026-001"),
  render: () => (
    <ProjectDetailView
      data={sampleDetail}
      catalog={sampleCatalog}
      model="anthropic/claude-haiku-5.5"
      enrich={fakeResult()}
      analyze={fakeResult()}
      eventActions={eventActions}
      decideProcurement={fakeResult()}
    />
  ),
};
export const ProjektTelefon: Story = { ...Projekt, ...phone, name: "Projekt (telefon)" };

export const Weryfikacja: Story = {
  parameters: path("/review"),
  render: () => <ReviewView data={sampleReview} eventActions={eventActions} decideProcurement={fakeResult()} decideCatalog={fakeResult()} />,
};
export const WeryfikacjaTelefon: Story = { ...Weryfikacja, ...phone, name: "Weryfikacja (telefon)" };

export const Modele: Story = {
  parameters: path("/llm"),
  render: () => (
    <LlmView
      projects={sampleProjects.map((p) => ({ id: p.id, title: p.title }))}
      selectedProject="RM-2026-001"
      models={[
        { id: "anthropic/claude-haiku-5.5", region: "USA (Anthropic)", price: "$0.10 / $0.50 za 1M tok." },
        { id: "mistral/ministral-14b", region: "UE (Mistral, Francja)", price: "$0.20 / $0.20 za 1M tok." },
      ]}
      metrics={[
        { model: "anthropic/claude-haiku-5.5", region: "USA (Anthropic)", createdAt: "2026-11-21", validSchema: true, error: null, latencyMs: 4200, tokensIn: 6100, tokensOut: 900, costUsd: 0.00106, costSource: "gateway", events: 4, codes: ["R02", "R06", "R07"], quotesVerified: 1, precision: 0.67, recall: 1, output: { events: [{ risk_code: "R02", title: "Nieprzewidziane wyburzenie murów", quote: "wyburzeniu murów ceglano -betonowych" }] } },
        { model: "mistral/ministral-14b", region: "UE (Mistral, Francja)", createdAt: "2026-11-21", validSchema: true, error: null, latencyMs: 3100, tokensIn: 6300, tokensOut: 1100, costUsd: 0.00148, costSource: "pricing", events: 3, codes: ["R06", "R07"], quotesVerified: 0.67, precision: 1, recall: 1, output: null },
      ]}
      goldCodes={["R06", "R07"]}
      productionModel="anthropic/claude-haiku-5.5"
      compare={fakeResult()}
    />
  ),
};
export const ModeleTelefon: Story = { ...Modele, ...phone, name: "Modele (telefon)" };

export const Eksport: Story = {
  parameters: path("/export"),
  render: () => (
    <ExportView
      entities={[
        { key: "projects", label: "Projekty", count: 22 },
        { key: "events", label: "Zdarzenia ryzyka", count: 55 },
        { key: "contracts", label: "Umowy, koszty i terminy", count: 15 },
      ]}
    />
  ),
};
