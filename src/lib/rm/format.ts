export const pln = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

export const pct = (v: number | null | undefined, signed = true) =>
  v == null ? "—" : `${signed && v > 0 ? "+" : ""}${Number(v).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

export const date = (v: string | null | undefined) => (v ? v.slice(0, 10) : "—");

export const usd = (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(v < 0.01 ? 5 : 4)} USD`);

export const days = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v} dni`);

export type ActionResult = { ok: boolean; message: string };

/** Polska odmiana liczebnika: plural(2, ["projekt", "projekty", "projektów"]) → "2 projekty". */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = n === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

/** Kwota skrócona do KPI: 2 107 348 → „2,11 mln zł”, 845 000 → „845 tys. zł”. */
export const plnShort = (v: number | null | undefined) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} mln zł`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000).toLocaleString("pl-PL")} tys. zł`;
  return pln(n);
};
