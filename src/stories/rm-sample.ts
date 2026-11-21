import type { ProjectListItem } from "@/components/screens/projects-list-view";
import type { ProjectDetailData } from "@/components/screens/project-detail-view";
import type { ReviewData } from "@/components/screens/review-view";
import type { CatalogEntry, RiskEvent, Source } from "@/lib/rm/types";

/** Dane przykładowe dla historii — odwzorowanie prawdziwego przypadku RM-2026-001 (Gmina Oława). */
const now = "2026-11-21T12:00:00Z";

export const sampleCatalog: CatalogEntry[] = [
  { code: "R02", name: "Niedostateczne rozpoznanie stanu istniejącego", effects: "Przeprojektowanie, nieprzewidziane roboty.", keywords: [], approved: true, proposed_by: "expert" },
  { code: "R06", name: "Nierealistyczny harmonogram i nieuwzględnione zależności", effects: "Opóźnienie, kary.", keywords: [], approved: true, proposed_by: "expert" },
  { code: "R07", name: "Nieprzewidziane zmiany i roboty dodatkowe", effects: "Aneks, przekroczenie budżetu.", keywords: [], approved: true, proposed_by: "expert" },
  { code: "P-a1b2-1", name: "Badania archeologiczne na trasie sieci", effects: "Wymóg konserwatora wydłuża roboty ziemne.", keywords: [], approved: false, proposed_by: "llm" },
];

const sources: Record<string, Source> = {
  s1: { id: "s1", kind: "bzp", title: "2022/BZP 00058537/01", url: "https://bzp.cytr.us/mo-board/api/v1/notice?NoticeType=ContractNotice&NoticeNumber=2022%2FBZP+00058537%2F01", external_id: "2022/BZP 00058537/01", fetched_at: now },
  s2: { id: "s2", kind: "bzp", title: "2022/BZP 00115288/01", url: "https://bzp.cytr.us/mo-board/api/v1/notice?NoticeType=TenderResultNotice", external_id: "2022/BZP 00115288/01", fetched_at: now },
  s3: { id: "s3", kind: "bzp", title: "2026/BZP 00147223/01", url: "https://bzp.cytr.us/mo-board/api/v1/notice?NoticeType=ContractPerformingNotice", external_id: "2026/BZP 00147223/01", fetched_at: now },
};

const baseEvent = {
  project_id: "RM-2026-001",
  contract_id: "c1",
  change_id: null,
  signal: null,
  event: null,
  impact: null,
  cause: null,
  mitigation: null,
  delay_days: null,
  cost_pln: null,
  llm_run_id: null,
  exemplary: false,
  created_at: now,
};

export const sampleEvents: RiskEvent[] = [
  {
    ...baseEvent,
    id: "e1",
    risk_code: "R06",
    title: "Wykonanie umowy po terminie (+77 dni)",
    signal: "Planowany termin 2023-04-06 (zawarcie 2022-04-06 + 12 mies.), wykonanie 2023-06-22.",
    event: "Umowa wykonana po pierwotnym terminie.",
    impact: "Opóźnienie o 77 dni.",
    delay_days: 77,
    quote: "5.3.) Czy umowę wykonano w pierwotnie określonym terminie: Nie",
    source_id: "s3",
    confidence: 0.95,
    origin: "rule",
    quote_verified: true,
    status: "proposed",
  },
  {
    ...baseEvent,
    id: "e2",
    risk_code: "R02",
    title: "Nieprzewidziane wyburzenie murów na trasie rurociągu",
    signal: "Roboty uzupełniające na podstawie protokołu (art. 455 ust. 2).",
    event: "Konieczność wyburzenia murów ceglano-betonowych i wywozu gruzu.",
    impact: "Wzrost kosztu o 9 337,83 zł.",
    cause: "Niezinwentaryzowane obiekty w pasie robót.",
    mitigation: "Inwentaryzacja i odkrywki przed przetargiem; pozycja rezerwowa w kosztorysie na przeszkody podziemne.",
    cost_pln: 9337.83,
    quote: "konieczność wykonania robót polegających na wyburzeniu murów ceglano -betonowych",
    source_id: "s3",
    confidence: 0.82,
    origin: "llm",
    quote_verified: true,
    status: "proposed",
  },
  {
    ...baseEvent,
    id: "e3",
    risk_code: "R07",
    title: "Wypłata wyższa niż wartość umowy (+6,6%)",
    signal: "Wartość umowy 2 107 348,39 zł, wypłacono 2 246 177,66 zł.",
    event: "Wzrost wynagrodzenia wykonawcy w trakcie realizacji.",
    impact: "Wzrost kosztu o 138 829,27 zł.",
    cost_pln: 138829.27,
    quote: "5.5.) Łączna wartość wynagrodzenia wypłacona z tytułu zrealizowanej umowy: 2246177,66 PLN",
    source_id: "s3",
    confidence: 0.95,
    origin: "rule",
    quote_verified: true,
    status: "accepted",
    exemplary: true,
  },
];

export const sampleProjects: ProjectListItem[] = [
  { id: "RM-2026-001", title: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice, gmina Oława", beneficiary_name: "Gmina Oława", province: "dolnośląskie", subsector_main: "Kanalizacja sanitarna", public_id_type: "Ogłoszenie BZP", enriched_at: now, procurements: 1, contract: { cost_deviation_pct: 6.59, delay_days: 77 }, events: { proposed: 2, accepted: 1 } },
  { id: "RM-2026-002", title: "Budowa kanalizacji sanitarnej na terenie Gminy Zagrodno w miejscowości Modlikowice", beneficiary_name: "Gmina Zagrodno", province: "dolnośląskie", subsector_main: "Kanalizacja sanitarna", public_id_type: "Projekt KPO", enriched_at: now, procurements: 1, contract: null, events: { proposed: 0, accepted: 0 } },
  { id: "RM-2026-004", title: "Modernizacja Stacji Uzdatniania Wody w Czernikowie", beneficiary_name: "Gmina Czernikowo", province: "kujawsko-pomorskie", subsector_main: "Uzdatnianie i zaopatrzenie w wodę", public_id_type: "Ogłoszenie BZP", enriched_at: null, procurements: 0, contract: null, events: { proposed: 0, accepted: 0 } },
];

export const sampleDetail: ProjectDetailData = {
  project: {
    id: "RM-2026-001",
    beneficiary_name: "Gmina Oława",
    beneficiary_nip: "9121715754",
    province_code: "02",
    province: "dolnośląskie",
    city: "Oława",
    title: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice, gmina Oława",
    record_scope: "całe postępowanie",
    public_id_type: "Ogłoszenie BZP",
    public_id: "2022/BZP 00058537/01",
    status: "Zakończone",
    annotation: null,
    project_value: null,
    co_financing: null,
    subsector_main: "Kanalizacja sanitarna",
    subsectors_extra: [],
    works_type: "budowa/rozbudowa",
    source_id: null,
    enriched_at: now,
    enrichment_log: [
      { at: now, step: "BZP: ogłoszenie po numerze", detail: "2022/BZP 00058537/01", url: sources.s1.url ?? undefined, count: 1 },
      { at: now, step: "BZP: ContractPerformingNotice po OCID", detail: "ocds-148610-386e6a91-8d90-11ec-94c8-de8df8ed9da1", count: 1 },
    ],
  },
  procurements: [
    {
      id: "p1",
      project_id: "RM-2026-001",
      ocid: "ocds-148610-386e6a91-8d90-11ec-94c8-de8df8ed9da1",
      bzp_number: "2022/BZP 00058537",
      title: "Budowa rurociągu tłocznego kanalizacji sanitarnej Godzikowice – Jaczkowice, gmina Oława",
      buyer_name: "Gmina Oława",
      buyer_nip: "9121715754",
      cpv: "45232410-9",
      match_method: "notice_number",
      match_confidence: 1,
      match_basis: ["numer ogłoszenia 2022/BZP 00058537/01 (identyfikator z pliku)", "NIP zamawiającego zgodny (9121715754)"],
      status: "accepted",
      notices: [
        { id: "n1", procurement_id: "p1", notice_type: "ContractNotice", notice_number: "2022/BZP 00058537/01", published_at: "2022-02-16", title: null, source_id: "s1" },
        { id: "n2", procurement_id: "p1", notice_type: "TenderResultNotice", notice_number: "2022/BZP 00115288/01", published_at: "2022-04-08", title: null, source_id: "s2" },
        { id: "n3", procurement_id: "p1", notice_type: "ContractPerformingNotice", notice_number: "2026/BZP 00147223/01", published_at: "2026-03-10", title: null, source_id: "s3" },
      ],
      contracts: [{
        id: "c1",
        procurement_id: "p1",
        part_no: 0,
        part_title: null,
        contractor_name: "Przedsiębiorstwo Budowlane COMPLEX-BUD Leon Szuturma",
        contractor_nip: "9120005157",
        signed_at: "2022-04-06",
        initial_value: 2107348.39,
        initial_months: 12,
        planned_end: "2023-04-06",
        actual_end: "2023-06-22",
        on_time: false,
        paid_total: 2246177.66,
        performed_properly: true,
        offers_count: 4,
        lowest_offer: 2107348.39,
        highest_offer: 4079410.03,
        cost_deviation_pct: 6.59,
        delay_days: 77,
        source_ids: ["s1", "s2", "s3"],
      }],
      changes: [
        { id: "ch3", contract_id: "c1", change_no: 3, changed_at: null, legal_basis: "art. 455 ust. 2 ustawy", reason: "roboty uzupełniające — wyburzenie murów ceglano-betonowych", description: null, value_change: 9337.83, price_increase: true, source_id: "s3" },
        { id: "ch4", contract_id: "c1", change_no: 4, changed_at: null, legal_basis: "art. 455 ust. 1 pkt 1 ustawy", reason: "protokół", description: "Strony ustalają, że przedmiot umowy zostanie wykonany w terminie 14 m-cy", value_change: null, price_increase: false, source_id: "s3" },
      ],
    },
  ],
  events: sampleEvents,
  sources,
};

export const sampleReview: ReviewData = {
  events: sampleEvents.filter((e) => e.status === "proposed").map((e) => ({ ...e, project_title: sampleDetail.project.title })),
  procurements: [
    {
      ...sampleDetail.procurements[0],
      id: "p2",
      project_id: "RM-2026-002",
      bzp_number: "2025/BZP 00012345",
      title: "Budowa kanalizacji sanitarnej w miejscowości Modlikowice",
      match_method: "kpo_search",
      match_confidence: 0.74,
      match_basis: ["NIP zamawiającego zgodny (6941566139)", "podobieństwo nazwy 68%", "ogłoszenie wspomina KPO"],
      status: "proposed",
      project_title: "Budowa kanalizacji sanitarnej na terenie Gminy Zagrodno w miejscowości Modlikowice",
    },
  ],
  catalog: sampleCatalog,
  decisions: [{ id: "d1", entity: "risk_event", entity_id: "e3000000", action: "exemplary", comment: "Wzorcowy przykład odchylenia kosztu", actor: "Ekspert", created_at: now }],
  sources,
};
