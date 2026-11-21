import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { projectColumns } from "@/lib/ingest/columns";

export const dynamic = "force-dynamic";

const csvCell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** GET /api/projects/template?format=xlsx|csv — pusty szablon pliku z projektami (same nagłówki). */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const name = `riskminer_szablon_projektow.${format}`;

  if (format === "csv") {
    // UTF-8 z BOM i średnik — polski Excel otwiera poprawnie.
    const body = "﻿" + projectColumns.map((c) => csvCell(c.header)).join(";") + "\r\n";
    return new NextResponse(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Risk Miner";

  const sheet = workbook.addWorksheet("Projekty", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = projectColumns.map((c) => ({ header: c.header, key: c.header, width: Math.max(14, Math.min(48, c.header.length + 4)) }));
  const header = sheet.getRow(1);
  header.eachCell((cell, col) => {
    const column = projectColumns[col - 1];
    cell.font = { bold: Boolean(column?.required || column?.recommended) };
    if (column?.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    if (column) cell.note = `${column.required ? "WYMAGANE. " : column.recommended ? "Zalecane. " : ""}${column.description}${column.example ? `\nPrzykład: ${column.example}` : ""}`;
  });

  const help = workbook.addWorksheet("Opis kolumn");
  help.columns = [
    { header: "Kolumna", key: "header", width: 34 },
    { header: "Wymagana", key: "required", width: 14 },
    { header: "Opis", key: "description", width: 80 },
    { header: "Przykład", key: "example", width: 48 },
  ];
  help.getRow(1).font = { bold: true };
  for (const c of projectColumns) {
    help.addRow({ header: c.header, required: c.required ? "tak" : c.recommended ? "zalecana" : "nie", description: c.description, example: c.example ?? "" });
  }
  help.getColumn("description").alignment = { wrapText: true, vertical: "top" };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
