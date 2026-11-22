import type { assessmentExport } from "./queries";
import { itemKindLabels, type Distribution, type ItemBasis, type ParamKey } from "./types";

type ExportData = NonNullable<Awaited<ReturnType<typeof assessmentExport>>>;
type ExportItem = ExportData["items"][number];

const basisLabel: Record<ItemBasis, string> = {
  calc: "obliczenie na danych przypadków",
  source: "zdarzenia udokumentowane w źródłach",
  expert: "katalog ekspercki",
  input: "dane podane przez użytkownika",
  llm: "wniosek modelu AI — do weryfikacji",
};
const originLabel: Record<string, string> = { input: "wpisane przez użytkownika", rule: "odczytane z opisu (reguła)", llm: "zaproponowane przez model AI" };
const paramLabels: Record<ParamKey, string> = {
  subsector_main: "Podsektor",
  works_type: "Rodzaj robót",
  province: "Województwo",
  length_m: "Długość sieci",
  budget_pln: "Budżet",
  duration_months: "Czas realizacji",
  local_conditions: "Warunki lokalne",
};

const nf = (v: number, digits = 0) => v.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pln = (v: number | null | undefined) => (v == null ? "—" : v >= 1_000_000 ? `${nf(v / 1_000_000, 2)} mln zł` : `${nf(v)} zł`);
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${nf(v, 1)}%`);
const txt = (v: unknown) => (v == null || v === "" ? "—" : String(v).replace(/\|/g, "/").replace(/\s+/g, " ").trim());
const dist = (d: Distribution | undefined, fmt: (v: number | null) => string) =>
  !d || !d.n ? "brak danych" : `mediana ${fmt(d.median)} · P25–P75 ${fmt(d.p25)} … ${fmt(d.p75)} · zakres ${fmt(d.min)} … ${fmt(d.max)} (n=${d.n})`;

function paramValue(key: ParamKey, v: unknown): string {
  if (v == null || v === "") return "—";
  if (key === "length_m") return `${nf(Number(v) / 1000, 2)} km`;
  if (key === "budget_pln") return pln(Number(v));
  if (key === "duration_months") return `${nf(Number(v), 1)} mies.`;
  return txt(v);
}

function itemLines(it: ExportItem, heading: string): string[] {
  const out = [heading, ""];
  if (it.body) out.push(txt(it.body), "");
  const meta = [`podstawa: ${basisLabel[it.basis] ?? it.basis}`];
  if (it.n_cases && it.n_total) meta.push(`wystąpiło w ${it.n_cases} z ${it.n_total} podobnych umów`);
  const projects = it.support?.project_ids ?? [];
  if (projects.length) meta.push(`inwestycje: ${projects.join(", ")}`);
  out.push(`_${meta.join(" · ")}_`, "");
  for (const ex of it.examples) {
    const src = ex.source ? (ex.source.url ? `[${txt(ex.source.title)}](${ex.source.url})` : txt(ex.source.title)) : "—";
    out.push(`> **${ex.project_id}**${ex.label ? ` — ${txt(ex.label)}` : ""}${ex.quote ? `: „${txt(ex.quote)}”` : ""}  \n> Źródło: ${src}`, "");
  }
  return out;
}

/** Raport oceny nowej inwestycji w Markdown — te same dane co eksport JSON, w formie do czytania. */
export function assessmentMarkdown(d: ExportData): string {
  const a = d.assessment;
  const s = d.summary;
  const out: string[] = [
    `# Ocena nowej inwestycji: ${txt(a.title)}`,
    "",
    `Risk Miner · wersja oceny ${a.version} · przeliczona ${txt(s?.generated_at?.slice(0, 16).replace("T", " "))} UTC · identyfikator ${a.id}`,
    "",
  ];

  if (a.description) out.push("## Opis planowanej inwestycji", "", a.description.trim(), "");

  out.push("## Parametry oceny", "", "| Parametr | Wartość | Pochodzenie |", "|---|---|---|");
  for (const key of Object.keys(paramLabels) as ParamKey[]) {
    const origin = (d.params_origin as Partial<Record<ParamKey, string>> | null)?.[key];
    out.push(`| ${paramLabels[key]} | ${paramValue(key, d.params?.[key])} | ${origin ? (originLabel[origin] ?? origin) : "—"} |`);
  }
  if (d.params?.subsectors_extra?.length) out.push(`| Podsektory dodatkowe | ${d.params.subsectors_extra.join(", ")} | — |`);
  out.push("");

  if (s) {
    out.push(
      "## Podsumowanie na podstawie podobnych zakończonych inwestycji",
      "",
      `Do statystyki weszło **${s.included}** z ${s.considered} najbardziej podobnych inwestycji (baza: ${s.corpus}). Niepewność: **${s.uncertainty}**.`,
      "",
    );
    const f = s.forecast;
    if (f?.cost) out.push(`- **Prognoza kosztu:** ${pln(f.cost.low)} – ${pln(f.cost.high)} (wartość środkowa ${pln(f.cost.mid)})`);
    if (f?.months) out.push(`- **Prognoza czasu realizacji:** ${nf(f.months.low, 1)} – ${nf(f.months.high, 1)} mies. (wartość środkowa ${nf(f.months.mid, 1)} mies.)`);
    out.push(
      `- Koszt wzrósł w ${s.share_cost_increase.k} z ${s.share_cost_increase.n} umów; po terminie zakończono ${s.share_delayed.k} z ${s.share_delayed.n}; aneksy w ${s.share_changed.k} z ${s.share_changed.n}.`,
    );
    if (f?.note) out.push("", `_${txt(f.note)}_`);
    out.push(
      "",
      "| Wskaźnik | Rozkład w podobnych umowach |",
      "|---|---|",
      `| Odchylenie kosztu | ${dist(s.cost, pct)} |`,
      `| Opóźnienie | ${dist(s.delay_days, (v) => (v == null ? "—" : `${nf(v)} dni`))} |`,
      `| Czas realizacji | ${dist(s.months, (v) => (v == null ? "—" : `${nf(v, 1)} mies.`))} |`,
      `| Wartość umowy | ${dist(s.value, pln)} |`,
      `| Koszt na km sieci | ${dist(s.cost_per_km, pln)} |`,
      `| Liczba ofert | ${dist(s.offers, (v) => (v == null ? "—" : nf(v)))} |`,
      "",
    );
    if (s.detected?.length) {
      out.push("Ryzyka wskazane przez treść opisu: " + s.detected.map((x) => `${x.code} (${x.terms.join(", ")})`).join("; ") + ".", "");
    }
  }

  const items = [...d.items].sort((x, y) => x.sort - y.sort);
  const flags = items.filter((it) => it.kind === "flag");
  if (flags.length) {
    out.push("## Flagi", "");
    flags.forEach((it) => out.push(...itemLines(it, `### ${txt(it.title)}`)));
  }

  const risks = items.filter((it) => it.kind === "risk");
  const related = (code: string | null, kind: ExportItem["kind"]) => items.filter((it) => it.kind === kind && it.risk_code === code);
  if (risks.length) {
    out.push("## Ryzyka i zalecenia", "");
    risks.forEach((r, i) => {
      out.push(...itemLines(r, `### ${i + 1}. ${txt(r.title)}`));
      for (const kind of ["check", "action", "clause"] as const) {
        const list = related(r.risk_code, kind);
        if (!list.length) continue;
        out.push(`**${itemKindLabels[kind]}:**`, "");
        list.forEach((it) => out.push(`- ${txt(it.title)}`));
        out.push("");
      }
    });
  }

  const riskCodes = new Set(risks.map((r) => r.risk_code));
  const rest = items.filter((it) => it.kind !== "flag" && it.kind !== "risk" && !(it.risk_code && riskCodes.has(it.risk_code) && ["check", "action", "clause"].includes(it.kind)));
  if (rest.length) {
    out.push("## Pozostałe uwagi", "");
    rest.forEach((it) => out.push(...itemLines(it, `### ${itemKindLabels[it.kind] ?? it.kind}: ${txt(it.title)}`)));
  }

  if (d.matches.length) {
    out.push(
      "## Podobne zakończone inwestycje",
      "",
      "| # | Inwestycja | Podobieństwo | Koszt | Opóźnienie | W statystyce | Ogłoszenie |",
      "|---|---|---|---|---|---|---|",
    );
    for (const m of [...d.matches].sort((x, y) => x.rank - y.rank)) {
      const notice = m.notice ? (m.notice.url ? `[${txt(m.notice.title)}](${m.notice.url})` : txt(m.notice.title)) : "—";
      out.push(
        `| ${m.rank} | ${m.project_id} ${txt(m.project_title)} (${txt(m.province)}) | ${nf(m.score, 1)}/100 | ${pct(m.cost_deviation_pct)} | ${m.delay_days == null ? "—" : `${m.delay_days} dni`} | ${m.included ? "tak" : `nie${m.excluded_reason ? ` — ${txt(m.excluded_reason)}` : ""}`} | ${notice} |`,
      );
    }
    out.push("", "Składowe podobieństwa:", "");
    for (const m of [...d.matches].sort((x, y) => x.rank - y.rank)) {
      out.push(`- **${m.project_id}:** ${m.components.filter((c) => c.applicable).map((c) => `${c.label} ${nf(c.points, 1)}/${c.weight} pkt (${txt(c.detail)})`).join("; ")}`);
    }
    out.push("");
  }

  out.push(
    "## Jak czytać ten raport",
    "",
    "Statystyka i prognozy to kwartyle z danych podobnych zakończonych inwestycji — dane historyczne, nie gwarancja. Ryzyka opierają się na zdarzeniach udokumentowanych w ogłoszeniach BZP (cytaty powyżej) i katalogu eksperckim R01–R15. Wszystkie pozycje czekają na decyzję eksperta.",
    "",
  );
  return out.join("\n");
}
