import "server-only";

import { db } from "@/lib/supabase/admin";

import type { CatalogEntry, Contract, ContractChange } from "./types";

type NoticeText = { type: string; sourceId: string; text: string };

/** Linia źródła zawierająca frazę — dosłowny cytat do weryfikacji przez jurora/eksperta. */
function lineWith(notices: NoticeText[], type: string, phrase: RegExp): { quote: string; sourceId: string } | null {
  const notice = notices.find((n) => n.type === type);
  if (!notice) return null;
  const line = notice.text.split("\n").find((l) => phrase.test(l));
  return line ? { quote: line.trim().slice(0, 400), sourceId: notice.sourceId } : null;
}

/** Kod ryzyka dla zmiany umowy: podstawa prawna + słowa kluczowe katalogu (katalog edytuje ekspert, bez zmian w kodzie). */
export function classifyChange(change: Pick<ContractChange, "legal_basis" | "reason" | "description">, catalog: CatalogEntry[]) {
  const text = `${change.legal_basis ?? ""} ${change.reason ?? ""} ${change.description ?? ""}`.toLowerCase();
  let best: { code: string; score: number; hits: string[] } = { code: "R07", score: 0, hits: [] };
  for (const entry of catalog) {
    const hits = entry.keywords.filter((k) => text.includes(k.toLowerCase()));
    if (hits.length > best.score) best = { code: entry.code, score: hits.length, hits };
  }
  if (/455 ust\. 1 pkt [34]/.test(text) && best.score < 2) best = { code: "R07", score: 2, hits: ["art. 455 ust. 1 pkt 3/4"] };
  return best;
}

/**
 * Zdarzenia proponowane regułami (bez LLM, koszt 0): fakty z ogłoszeń o wykonaniu i zmianie umowy.
 * Każde ma dosłowny cytat ze źródła. Zdarzenia już ocenione przez eksperta zostają nietknięte.
 */
export async function proposeRuleEvents(input: { projectId: string; contractId: string; catalog: CatalogEntry[]; notices: NoticeText[] }) {
  const { projectId, contractId, catalog, notices } = input;
  const supabase = db();

  const [{ data: contract }, { data: changes }, { data: decided }] = await Promise.all([
    supabase.from("rm_contracts").select("*").eq("id", contractId).single(),
    supabase.from("rm_contract_changes").select("*").eq("contract_id", contractId),
    supabase.from("rm_risk_events").select("risk_code,title,change_id").eq("contract_id", contractId).eq("origin", "rule").neq("status", "proposed"),
  ]);
  if (!contract) return 0;
  const c = contract as Contract;

  await supabase.from("rm_risk_events").delete().eq("contract_id", contractId).eq("origin", "rule").eq("status", "proposed");

  const already = new Set((decided ?? []).map((d) => `${d.risk_code}|${d.title}|${d.change_id ?? ""}`));
  const rows: Record<string, unknown>[] = [];
  const push = (row: Record<string, unknown>) => {
    if (already.has(`${row.risk_code}|${row.title}|${row.change_id ?? ""}`)) return;
    rows.push({ project_id: projectId, contract_id: contractId, origin: "rule", status: "proposed", quote_verified: true, ...row });
  };

  if (c.delay_days && c.delay_days > 0) {
    const src = lineWith(notices, "ContractPerformingNotice", /5\.3\.\)/) ?? lineWith(notices, "ContractPerformingNotice", /5\.2\.\)/);
    push({
      risk_code: "R06",
      title: `Wykonanie umowy po terminie (+${c.delay_days} dni)`,
      signal: `Planowany termin ${c.planned_end} (zawarcie ${c.signed_at} + ${c.initial_months} mies.), wykonanie ${c.actual_end}.`,
      event: "Umowa wykonana po pierwotnym terminie.",
      impact: `Opóźnienie o ${c.delay_days} dni.`,
      delay_days: c.delay_days,
      quote: src?.quote ?? null,
      source_id: src?.sourceId ?? null,
      confidence: 0.95,
    });
  }

  if (c.cost_deviation_pct && c.cost_deviation_pct > 0 && c.paid_total && c.initial_value) {
    const src = lineWith(notices, "ContractPerformingNotice", /5\.5\.\)/);
    push({
      risk_code: "R07",
      title: `Wypłata wyższa niż wartość umowy (+${c.cost_deviation_pct.toFixed(1)}%)`,
      signal: `Wartość umowy ${c.initial_value} zł, wypłacono ${c.paid_total} zł.`,
      event: "Wzrost wynagrodzenia wykonawcy w trakcie realizacji.",
      impact: `Wzrost kosztu o ${(c.paid_total - c.initial_value).toFixed(2)} zł.`,
      cost_pln: Math.round((c.paid_total - c.initial_value) * 100) / 100,
      quote: src?.quote ?? null,
      source_id: src?.sourceId ?? null,
      confidence: 0.95,
    });
  }

  if (c.offers_count === 1) {
    const src = lineWith(notices, "TenderResultNotice", /6\.1\.\)/);
    push({
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

  for (const change of (changes ?? []) as ContractChange[]) {
    const generic = /^(protokół|porozumienie|aneks|zmiana harmonogramu[\w\s-]*)$/i.test((change.reason ?? "").trim());
    const termChange = /termin|m-cy|miesi|harmonogram/i.test(`${change.reason} ${change.description}`);
    if (!change.value_change && !termChange && generic) continue;
    const { code, hits } = classifyChange(change, catalog);
    push({
      change_id: change.id,
      risk_code: code,
      title: `Zmiana umowy nr ${change.change_no ?? "—"}: ${(change.reason ?? "bez opisu").slice(0, 90)}`,
      signal: `Podstawa: ${change.legal_basis ?? "brak"}. Dopasowane słowa katalogu: ${hits.join(", ") || "—"}.`,
      event: change.description?.slice(0, 600) ?? null,
      cause: change.reason,
      cost_pln: change.value_change,
      quote: (change.reason ?? change.description ?? "").slice(0, 400),
      source_id: change.source_id,
      confidence: hits.length >= 2 ? 0.7 : 0.5,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("rm_risk_events").insert(rows);
    if (error) throw new Error(`Zapis zdarzeń: ${error.message}`);
  }
  return rows.length;
}
