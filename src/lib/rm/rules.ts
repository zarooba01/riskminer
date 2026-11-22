import "server-only";

import { db } from "@/lib/supabase/admin";

import { pln } from "./format";
import { daysBetween } from "./notice-parse";
import type { CatalogEntry, Contract, ContractChange } from "./types";

type NoticeText = { type: string; sourceId: string; text: string };

/** Skrócenie tekstu do ~n znaków na granicy słowa, z wielokropkiem. */
function clipWords(text: string, n: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= n) return clean;
  const cut = clean.slice(0, n);
  const space = cut.lastIndexOf(" ");
  return `${(space > n * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Linia źródła zawierająca frazę — dosłowny cytat do weryfikacji przez jurora/eksperta. */
function lineWith(notices: NoticeText[], type: string, phrase: RegExp): { quote: string; sourceId: string } | null {
  const notice = notices.find((n) => n.type === type);
  if (!notice) return null;
  const line = notice.text.split("\n").find((l) => phrase.test(l));
  return line ? { quote: line.trim().slice(0, 400), sourceId: notice.sourceId } : null;
}

/** Zmiana dotyczy terminu (wydłużenie, harmonogram), nawet jeśli nie podaje nowej daty. */
const isTermChange = (ch: Pick<ContractChange, "reason" | "description">) => /termin|m-cy|miesi|harmonogram|wydłuż|przedłuż/i.test(`${ch.reason ?? ""} ${ch.description ?? ""}`);

/** Kod ryzyka dla zmiany umowy: podstawa prawna + słowa kluczowe katalogu (katalog edytuje ekspert, bez zmian w kodzie). */
export function classifyChange(change: Pick<ContractChange, "legal_basis" | "reason" | "description">, catalog: CatalogEntry[]) {
  const text = `${change.legal_basis ?? ""} ${change.reason ?? ""} ${change.description ?? ""}`.toLowerCase();
  const reason = (change.reason ?? "").toLowerCase();
  let best: { code: string; score: number; hits: string[] } = { code: "R07", score: 0, hits: [] };
  for (const entry of catalog) {
    const hits = entry.keywords.filter((k) => text.includes(k.toLowerCase()));
    // Przyczyna zmiany waży podwójnie: opis aneksu zwykle mówi o skutku (np. „termin wydłużony”), przyczyna — o źródle ryzyka.
    const score = hits.length + entry.keywords.filter((k) => reason.includes(k.toLowerCase())).length;
    if (score > best.score) best = { code: entry.code, score, hits };
  }
  if (/455 ust\. 1 pkt [34]/.test(text) && best.score < 3) best = { code: "R07", score: 2, hits: ["art. 455 ust. 1 pkt 3/4"] };
  return best;
}

/**
 * Zdarzenia proponowane regułami (bez LLM, koszt 0): fakty z ogłoszeń o wykonaniu i zmianie umowy.
 * Każde ma dosłowny cytat ze źródła. Zdarzenia już ocenione przez eksperta zostają nietknięte.
 */
export async function proposeRuleEvents(input: { projectId: string; contractId: string; catalog: CatalogEntry[]; notices: NoticeText[] }) {
  const { projectId, contractId, catalog, notices } = input;
  const supabase = db();

  const [{ data: contract }, { data: changes }, { data: existing }] = await Promise.all([
    supabase.from("rm_contracts").select("*").eq("id", contractId).maybeSingle(),
    supabase.from("rm_contract_changes").select("*").eq("contract_id", contractId),
    supabase.from("rm_risk_events").select("id,rule_key,status").eq("contract_id", contractId).eq("origin", "rule"),
  ]);
  if (!contract) return 0;
  const c = contract as Contract;

  // Każda propozycja ma stały klucz reguły — dzięki temu ponowne wzbogacenie aktualizuje ją w miejscu
  // (ten sam identyfikator), a decyzji eksperta (zatwierdzone / odrzucone) w ogóle nie dotyka.
  const rows: (Record<string, unknown> & { rule_key: string })[] = [];
  const push = (rule_key: string, row: Record<string, unknown>) => {
    rows.push({ project_id: projectId, contract_id: contractId, origin: "rule", quote_verified: true, ...row, rule_key });
  };

  const allChanges = ((changes ?? []) as ContractChange[]).sort((a, b) => (a.change_no ?? 0) - (b.change_no ?? 0));
  const termChanges = allChanges.filter((ch) => ch.new_end_date || isTermChange(ch));
  const valueChanges = allChanges.filter((ch) => ch.value_change);
  const label = (ch: ContractChange) => `zmiana nr ${ch.change_no ?? "—"}${ch.legal_basis ? ` (${ch.legal_basis.replace(/\s*ustawy\s*$/, "")})` : ""}`;

  // Bez zdarzenia, gdy ogłoszenie o wykonaniu wprost podaje wykonanie w pierwotnym terminie (pkt 5.3: „Tak”).
  if (c.delay_days && c.delay_days > 0 && c.on_time !== true) {
    const src = lineWith(notices, "ContractPerformingNotice", /5\.3\.\)/) ?? lineWith(notices, "ContractPerformingNotice", /5\.2\.\)/);
    const lastTerm = [...termChanges].filter((ch) => ch.new_end_date).sort((a, b) => a.new_end_date!.localeCompare(b.new_end_date!)).at(-1);
    const withinAmended = Boolean(lastTerm?.new_end_date && c.actual_end && c.actual_end <= lastTerm.new_end_date);
    push("delay", {
      risk_code: "R06",
      title: `Wykonanie umowy po terminie (+${c.delay_days} dni)`,
      signal: `Planowany termin ${c.planned_end} (zawarcie ${c.signed_at}${c.initial_months ? ` + ${c.initial_months} mies.` : ""}), wykonanie ${c.actual_end}.`,
      event: "Umowa wykonana po pierwotnym terminie.",
      // Przyczyna tylko wtedy, gdy źródło ją podaje — przy zmianie terminu w aneksie; inaczej „brak danych” w interfejsie.
      cause: termChanges.length ? termChanges.map((ch) => `${label(ch)}: ${clipWords(ch.reason ?? ch.description ?? "bez opisu", 220)}`).join(" · ") : null,
      impact:
        `Opóźnienie o ${c.delay_days} dni względem pierwotnego terminu.` +
        (lastTerm?.new_end_date ? ` Termin zmieniony aneksem do ${lastTerm.new_end_date}${withinAmended ? " — prace zakończono w zmienionym terminie." : " — prace zakończono także po zmienionym terminie."}` : ""),
      delay_days: c.delay_days,
      quote: src?.quote ?? null,
      source_id: src?.sourceId ?? null,
      confidence: 0.95,
    });
  }

  if (c.cost_deviation_pct && c.cost_deviation_pct > 0 && c.paid_total && c.initial_value) {
    const src = lineWith(notices, "ContractPerformingNotice", /5\.5\.\)/);
    const increase = Math.round((c.paid_total - c.initial_value) * 100) / 100;
    const explained = valueChanges.reduce((a, ch) => a + Number(ch.value_change ?? 0), 0);
    const share = increase ? Math.round((explained / increase) * 100) : 0;
    push("cost", {
      risk_code: "R07",
      title: `Wypłata wyższa niż wartość umowy (+${c.cost_deviation_pct.toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%)`,
      signal: `Wartość umowy ${pln(c.initial_value)}, wypłacono ${pln(c.paid_total)}.`,
      event: "Wzrost wynagrodzenia wykonawcy w trakcie realizacji.",
      cause: valueChanges.length ? valueChanges.map((ch) => `${label(ch)}: ${pln(ch.value_change)} — ${clipWords(ch.reason ?? ch.description ?? "bez opisu", 160)}`).join(" · ") : null,
      impact: `Wzrost kosztu o ${pln(increase)}.${valueChanges.length ? ` Zmiany umowy z kwotą łącznie ${pln(explained)} (${share}% wzrostu).` : ""}`,
      cost_pln: increase,
      quote: src?.quote ?? null,
      source_id: src?.sourceId ?? null,
      confidence: 0.95,
    });
  }

  if (c.offers_count === 1) {
    const src = lineWith(notices, "TenderResultNotice", /6\.1\.\)/);
    push("single_offer", {
      risk_code: "R11",
      title: "Tylko jedna oferta w postępowaniu",
      signal: "Ograniczona konkurencja.",
      event: "Wpłynęła jedna oferta.",
      impact: "Ryzyko wyższej ceny i słabszej pozycji negocjacyjnej zamawiającego.",
      quote: src?.quote ?? null,
      source_id: src?.sourceId ?? null,
      confidence: 0.8,
    });
  }

  for (const change of allChanges) {
    const generic = /^(protokół|porozumienie|aneks|zmiana harmonogramu[\w\s-]*)$/i.test((change.reason ?? "").trim());
    const termChange = Boolean(change.new_end_date) || isTermChange(change);
    if (!change.value_change && !termChange && generic) continue;
    const { code, hits } = classifyChange(change, catalog);
    // Skutek zmiany tylko z danych źródła: kwota albo nowy termin. Brak — interfejs pokaże „brak danych”.
    const shift = change.new_end_date && c.planned_end ? daysBetween(c.planned_end, change.new_end_date) : null;
    const effects = [
      change.value_change ? `Wynagrodzenie ${change.value_change > 0 ? "+" : ""}${pln(change.value_change)}${c.initial_value ? ` (${((change.value_change / c.initial_value) * 100).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}% wartości umowy)` : ""}.` : null,
      change.new_end_date ? `Termin wykonania zmieniony na ${change.new_end_date}${shift != null ? ` (${shift > 0 ? "+" : ""}${shift} dni względem pierwotnego ${c.planned_end})` : ""}.` : null,
    ].filter(Boolean);
    push(`change:${change.id}`, {
      change_id: change.id,
      risk_code: code,
      title: `Zmiana umowy nr ${change.change_no ?? "—"}: ${clipWords(change.reason ?? "bez opisu", 90)}`,
      signal: `Podstawa: ${change.legal_basis ?? "brak"}${change.changed_at ? `, data zmiany ${change.changed_at}` : ""}. Dopasowane słowa katalogu: ${hits.join(", ") || "—"}.`,
      event: change.description?.slice(0, 600) ?? null,
      cause: change.reason,
      impact: effects.length ? effects.join(" ") : null,
      cost_pln: change.value_change,
      delay_days: shift != null && shift > 0 ? shift : null,
      quote: (change.reason ?? change.description ?? "").slice(0, 400),
      source_id: change.source_id,
      confidence: hits.length >= 2 ? 0.7 : 0.5,
    });
  }

  const byKey = new Map((existing ?? []).filter((e) => e.rule_key).map((e) => [e.rule_key as string, e]));
  const keep = new Set(rows.map((r) => r.rule_key));
  let proposed = 0;
  for (const row of rows) {
    const current = byKey.get(row.rule_key);
    if (current && current.status !== "proposed") continue; // decyzja eksperta zostaje bez zmian
    proposed++;
    const { error } = current
      ? await supabase.from("rm_risk_events").update({ ...row, updated_at: new Date().toISOString() }).eq("id", current.id)
      : await supabase.from("rm_risk_events").insert({ ...row, status: "proposed" });
    if (error) throw new Error(`Zapis zdarzeń: ${error.message}`);
  }
  // Propozycje, których reguły już nie wskazują (np. dane w BZP się zmieniły), oraz stare wpisy bez klucza.
  const stale = (existing ?? []).filter((e) => e.status === "proposed" && (!e.rule_key || !keep.has(e.rule_key))).map((e) => e.id);
  if (stale.length) await supabase.from("rm_risk_events").delete().in("id", stale);
  return proposed;
}
