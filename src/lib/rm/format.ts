export const pln = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

export const pct = (v: number | null | undefined, signed = true) =>
  v == null ? "—" : `${signed && v > 0 ? "+" : ""}${Number(v).toLocaleString("pl-PL", { maximumFractionDigits: 1 })}%`;

export const date = (v: string | null | undefined) => (v ? v.slice(0, 10) : "—");

export const usd = (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(v < 0.01 ? 5 : 4)} USD`);

export const days = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v} dni`);

export type ActionResult = { ok: boolean; message: string };
