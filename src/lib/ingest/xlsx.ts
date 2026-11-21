import "server-only";

import ExcelJS from "exceljs";

import { normalizeNip } from "./bzp";
import { columnFieldByHeader, normalizeHeader, requiredHeaders } from "./columns";

export type ProjectRow = {
  id: string;
  beneficiary_name: string;
  beneficiary_nip: string | null;
  province_code: string | null;
  province: string | null;
  city: string | null;
  title: string;
  record_scope: string | null;
  public_id_type: string | null;
  public_id: string | null;
  status: string | null;
  annotation: string | null;
  project_value: number | null;
  co_financing: number | null;
  subsector_main: string | null;
  subsectors_extra: string[];
  works_type: string | null;
};

const amountAfter = (text: string, label: RegExp) => {
  const m = text.match(new RegExp(`${label.source}\\s*:?\\s*([\\d\\s]+,\\d{2})`, "i"));
  return m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : null;
};

/** Klasyfikacja podsektorów wg materiału eksperckiego (podsektor główny + dodatkowe, rodzaj robót osobno). */
export function classifySubsectors(text: string): { main: string | null; extra: string[]; worksType: string | null } {
  const t = text.toLowerCase();
  const hits: string[] = [];
  const add = (name: string, re: RegExp) => {
    const i = t.search(re);
    if (i >= 0) hits.push(`${String(i).padStart(5, "0")}|${name}`);
  };
  add("Kanalizacja sanitarna", /kanalizac\w* sanitarn|rurociąg\w* tłoczn|tranzyt\w* przesył|kanalizac\w* ściek/);
  add("Sieć wodociągowa", /sieci? wodociąg|wodociąg/);
  add("Oczyszczalnia ścieków", /oczyszczal/);
  add("Uzdatnianie i zaopatrzenie w wodę", /uzdatniania wody|stacj\w* uzdatn|\bsuw\b|ujęci/);
  add("Kanalizacja deszczowa i retencja", /deszczow|retenc/);
  const ordered = hits.sort().map((h) => h.split("|")[1]);
  const worksType = /przebudow|modernizac|renowac|remont|wymian/.test(t)
    ? "przebudowa/modernizacja"
    : /budow|rozbudow/.test(t)
      ? "budowa/rozbudowa"
      : null;
  return { main: ordered[0] ?? (t ? "Inne obiekty wod-kan" : null), extra: ordered.slice(1), worksType };
}

const cellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) return value.richText.map((r) => r.text).join("");
  if (typeof value === "object" && "text" in value) return String(value.text);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
};

export type ParseResult = { rows: ProjectRow[]; warnings: string[] };

/** Wspólna część importu XLSX i CSV: nagłówek → pola, walidacja wymaganych kolumn i NIP, podsektory. */
export function rowsFromTable(header: string[], table: string[][]): ParseResult {
  const normalized = header.map(normalizeHeader);
  const missing = requiredHeaders.filter((h) => !normalized.includes(normalizeHeader(h)));
  if (missing.length) {
    throw new Error(`Brak wymaganych kolumn: ${missing.join(", ")}. Pobierz szablon, żeby zobaczyć poprawne nagłówki.`);
  }

  const warnings: string[] = [];
  const rows: ProjectRow[] = [];
  table.forEach((cells, index) => {
    const record: Record<string, string> = {};
    cells.forEach((value, col) => {
      const field = columnFieldByHeader.get(normalized[col]);
      if (field) record[field] = (value ?? "").trim();
    });
    if (!record.id && !record.title) return; // pusty wiersz
    if (!record.id || !record.title) {
      warnings.push(`Wiersz ${index + 2}: brak „Identyfikator rekordu” lub „Nazwa przedsięwzięcia” — pominięto.`);
      return;
    }

    const nip = normalizeNip(record.beneficiary_nip);
    if (record.beneficiary_nip && !nip) warnings.push(`${record.id}: NIP ${record.beneficiary_nip} nie przechodzi walidacji sumy kontrolnej.`);
    const annotation = record.annotation || null;
    const sub = classifySubsectors(`${record.title} ${annotation ?? ""}`);

    rows.push({
      id: record.id,
      beneficiary_name: record.beneficiary_name ?? "",
      beneficiary_nip: nip ?? (record.beneficiary_nip || null),
      province_code: record.province_code ? record.province_code.padStart(2, "0") : null,
      province: record.province || null,
      city: record.city || null,
      title: record.title,
      record_scope: record.record_scope || null,
      public_id_type: record.public_id_type || null,
      public_id: record.public_id || null,
      status: record.status || null,
      annotation,
      project_value: annotation ? amountAfter(annotation, /Wartość przedsięwzięcia/) : null,
      co_financing: annotation ? amountAfter(annotation, /dofinansowanie/) : null,
      subsector_main: sub.main,
      subsectors_extra: sub.extra,
      works_type: sub.worksType,
    });
  });
  return { rows, warnings };
}

export async function parseProjectsXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Projekty") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Plik nie zawiera arkusza z projektami.");

  // ExcelJS numeruje kolumny od 1 — indeks 0 tablicy values jest pusty.
  const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((v) => cellText(v));
  const table: string[][] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    table.push(header.map((_, col) => cellText(values[col])));
  });
  return rowsFromTable(header, table);
}

/** Minimalny parser CSV (RFC 4180): cudzysłowy, "" wewnątrz pola, separator ; lub , wykrywany z nagłówka, BOM. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseProjectsCsv(buffer: ArrayBuffer): ParseResult {
  const [header, ...table] = parseCsv(new TextDecoder("utf-8").decode(buffer));
  if (!header) throw new Error("Plik CSV jest pusty.");
  return rowsFromTable(header, table);
}

/** Wybór parsera po rozszerzeniu pliku. */
export async function parseProjectsFile(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  if (/\.csv$/i.test(fileName)) return parseProjectsCsv(buffer);
  if (/\.xlsx$/i.test(fileName)) return parseProjectsXlsx(buffer);
  throw new Error("Obsługiwane formaty: .xlsx i .csv (układ jak w szablonie).");
}
