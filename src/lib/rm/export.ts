/** Encje dostępne do eksportu: nazwa w URL → tabela + kolumny (bez surowych treści dokumentów). */
export const exportEntities = {
  projects: { table: "rm_projects", label: "Projekty", select: "*" },
  procurements: { table: "rm_procurements", label: "Postępowania i dopasowania", select: "*" },
  notices: { table: "rm_notices", label: "Ogłoszenia (z polami sparsowanymi)", select: "*" },
  contracts: { table: "rm_contracts", label: "Umowy, koszty i terminy", select: "*" },
  changes: { table: "rm_contract_changes", label: "Zmiany umów", select: "*" },
  events: { table: "rm_risk_events", label: "Zdarzenia ryzyka", select: "*" },
  catalog: { table: "rm_risk_catalog", label: "Katalog ryzyk", select: "*" },
  sources: { table: "rm_sources", label: "Źródła (identyfikator, link, data pobrania)", select: "id,kind,title,url,external_id,fetched_at,content_hash" },
  llm_runs: { table: "rm_llm_runs", label: "Przebiegi modeli (koszt, czas, wynik)", select: "*" },
  decisions: { table: "rm_decisions", label: "Historia decyzji eksperta", select: "*" },
} as const;

export type ExportEntity = keyof typeof exportEntities;

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}
