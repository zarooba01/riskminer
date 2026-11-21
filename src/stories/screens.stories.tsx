import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AppShell } from "@/components/layout/app-shell";
import { AssessmentDetailView } from "@/components/screens/assessment-detail-view";
import { AssessmentsView } from "@/components/screens/assessments-view";
import { MethodologyView } from "@/components/screens/methodology-view";
import { NewAssessmentView } from "@/components/screens/new-assessment-view";
import { ReferenceBaseView } from "@/components/screens/reference-base-view";
import { DashboardView } from "@/components/screens/dashboard-view";
import { ExportView } from "@/components/screens/export-view";
import { LlmView } from "@/components/screens/llm-view";
import { ProjectDetailView } from "@/components/screens/project-detail-view";
import { ProjectsListView } from "@/components/screens/projects-list-view";
import { ReviewView } from "@/components/screens/review-view";
import { SourceView } from "@/components/screens/source-view";
import { Toaster } from "@/components/ui/sonner";

import { demoUser, fakeResult, phone } from "./helpers";
import { sampleAssessment, sampleAssessments } from "./rm-assessment-sample";
import { sampleCatalog, sampleDetail, sampleProjects, sampleReview, sampleSource } from "./rm-sample";

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
  render: () => (
    <ProjectsListView
      projects={sampleProjects}
      addProject={async () => ({ ok: true, message: "Dodano projekt RM-2026-023.", projectId: "RM-2026-023" })}
      suggestedId="RM-2026-023"
      addAction={async () => ({ ok: true, message: "Dodano 1 z 3 rekordów. Pominięto duplikaty: 2.", added: ["RM-2026-023"], skipped: [{ id: "RM-2026-001", title: "", reason: "identyfikator RM-2026-001 już istnieje w bazie" }], warnings: [] })}
      enrichAction={fakeResult()}
      searchAction={async (id: string) => ({ ok: true, projectId: id, message: `${id}: 2022/BZP 00058537 (po numerze ogłoszenia), ogłoszeń: 3` })}
      buildAction={async (id: string) => ({ ok: true, projectId: id, message: `${id}: umów 1, zmian 6, zdarzeń 8 · koszt +6,6%, czas +77 dni` })}
    />
  ),
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

export const Zrodlo: Story = {
  name: "Źródło z zaznaczonym fragmentem",
  parameters: path("/sources/s3"),
  render: () => <SourceView source={sampleSource} quote="Czy umowę wykonano w pierwotnie określonym terminie: Nie" backHref="/projects/RM-2026-001" />,
};

export const ZrodloTelefon: Story = { ...Zrodlo, ...phone, name: "Źródło z zaznaczonym fragmentem (telefon)" };

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

export const NowaInwestycja: Story = {
  name: "Nowa inwestycja — formularz",
  parameters: path("/assessments/new"),
  render: () => <NewAssessmentView model="anthropic/claude-haiku-5.5" region="USA (Anthropic)" />,
};
export const NowaInwestycjaTelefon: Story = { ...NowaInwestycja, ...phone, name: "Nowa inwestycja (telefon)" };

export const ZapisaneOceny: Story = {
  name: "Zapisane oceny",
  parameters: path("/assessments"),
  render: () => <AssessmentsView assessments={sampleAssessments} remove={fakeResult()} />,
};
export const ZapisaneOcenyTelefon: Story = { ...ZapisaneOceny, ...phone, name: "Zapisane oceny (telefon)" };

export const OcenaInwestycji: Story = {
  name: "Ocena inwestycji — wynik",
  parameters: path("/assessments"),
  render: () => <AssessmentDetailView data={sampleAssessment} model="anthropic/claude-haiku-5.5" region="USA (Anthropic)" rerun={fakeResult()} saveParams={fakeResult()} decide={fakeResult()} />,
};
export const OcenaInwestycjiTelefon: Story = { ...OcenaInwestycji, ...phone, name: "Ocena inwestycji (telefon)" };

export const Obliczenia: Story = {
  parameters: path("/methodology"),
  render: () => <MethodologyView corpus={23} />,
};
export const ObliczeniaTelefon: Story = { ...Obliczenia, ...phone, name: "Obliczenia (telefon)" };

export const BazaPorownawcza: Story = {
  name: "Baza porównawcza",
  parameters: path("/reference"),
  render: () => (
    <ReferenceBaseView
      rebuild={fakeResult()}
      data={{
        lastBuild: { at: "2026-11-21T22:40:00Z", skipped: [{ projectId: "RM-2026-022", reason: "brak zdarzeń ryzyka w źródłach" }] },
        cases: [
          { project_id: "RM-2026-001", title: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice", beneficiary_name: "Gmina Oława", province: "dolnośląskie", subsector_main: "Kanalizacja sanitarna", works_type: "budowa/rozbudowa", value: 2107348, paid: 2246178, cost_deviation_pct: 6.59, months: 12, delay_days: 77, bzp_number: "2023/BZP 00123456", match_confidence: 1, match_origin: "accepted", snapshot_at: "2026-11-21T22:40:00Z", events: 8, risk_codes: ["R06", "R07"] },
          { project_id: "RM-2026-017", title: "Budowa sieci kanalizacji sanitarnej wraz z przyłączami w miejscowości Tanibórz", beneficiary_name: "Gmina Kleszczewo", province: "wielkopolskie", subsector_main: "Kanalizacja sanitarna", works_type: "budowa/rozbudowa", value: 4275776, paid: 5422900, cost_deviation_pct: 26.83, months: 4, delay_days: 53, bzp_number: "2025/BZP 00358528", match_confidence: 0.95, match_origin: "auto", snapshot_at: "2026-11-21T22:40:00Z", events: 3, risk_codes: ["R06", "R07"] },
        ],
      }}
    />
  ),
};
export const BazaPorownawczaTelefon: Story = { ...BazaPorownawcza, ...phone, name: "Baza porównawcza (telefon)" };
