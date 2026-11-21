import "server-only";

import ExcelJS from "exceljs";

import { normalizeNip } from "./bzp";

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

/** Nagłówki kolumn pliku organizatora → pola rekordu. Nieznane kolumny są pomijane. */
const columns: Record<string, keyof ProjectRow | "nip_type"> = {
  "identyfikator rekordu": "id",
  "rodzaj identyfikatora odbiorcy": "nip_type",
  "identyfikator odbiorcy": "beneficiary_nip",
  "nazwa odbiorcy": "beneficiary_name",
  "kod województwa (teryt)": "province_code",
  województwo: "province",
  "siedziba odbiorcy": "city",
  "nazwa przedsięwzięcia": "title",
  "zakres rekordu": "record_scope",
  "rodzaj identyfikatora publicznego": "public_id_type",
  "identyfikator publiczny": "public_id",
  "status przedsięwzięcia": "status",
  "adnotacja instytucji": "annotation",
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

export async function parseProjectsXlsx(buffer: ArrayBuffer): Promise<{ rows: ProjectRow[]; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Projekty") ?? workbook.worksheets[0];
  if (!sheet) throw new Error("Plik nie zawiera arkusza z projektami.");

  const header = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((v) => cellText(v).trim().toLowerCase());
  const warnings: string[] = [];
  const rows: ProjectRow[] = [];

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record: Record<string, string> = {};
    (row.values as ExcelJS.CellValue[]).forEach((value, col) => {
      const key = columns[header[col]];
      if (key) record[key] = cellText(value).trim();
    });
    if (!record.id || !record.title) return;

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
