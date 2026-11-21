import type { Contract, Project } from "./types";

/** Podsumowanie umów projektu (KPI): wartość, wypłata, odchylenie kosztu, opóźnienie. */
export type ContractSummary = Pick<Contract, "initial_value" | "paid_total" | "cost_deviation_pct" | "delay_days">;

/** Numer części z zakresu rekordu („część 2” → 2; całe postępowanie → 0). */
export const scopePartOf = (recordScope: string | null | undefined) => Number(recordScope?.match(/część\s*(\d+)/i)?.[1] ?? 0);

/**
 * Odchylenie projektu: rekord „część N” → umowa tej części; całe postępowanie w częściach → suma umów
 * (koszt łączny, opóźnienie maksymalne). Obliczenie — nie dana źródłowa.
 */
export function summarizeContracts(project: Pick<Project, "record_scope">, contracts: Contract[]): ContractSummary | null {
  if (!contracts.length) return null;
  const scopePart = scopePartOf(project.record_scope);
  const own = scopePart ? contracts.filter((c) => c.part_no === scopePart) : [];
  const set = own.length ? own : contracts;
  if (set.length === 1) return set[0];
  const initial = set.reduce((a, c) => a + Number(c.initial_value ?? 0), 0);
  const paidKnown = set.every((c) => c.paid_total != null);
  const paid = set.reduce((a, c) => a + Number(c.paid_total ?? 0), 0);
  const delays = set.map((c) => c.delay_days).filter((d): d is number => d != null);
  return {
    initial_value: initial || null,
    paid_total: paidKnown ? paid : null,
    cost_deviation_pct: paidKnown && initial ? Math.round(((paid - initial) / initial) * 10000) / 100 : null,
    delay_days: delays.length ? Math.max(...delays) : null,
  };
}

