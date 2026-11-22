// Buduje demo/RM-TEST-demo.xlsx: nagłówek + wiersz Gminy Zagrodno (RM-2026-002) z pliku organizatora,
// z identyfikatorem RM-TEST-DEMO-001 (żeby po nagraniu dało się usunąć wyłącznie ten rekord).
import ExcelJS from "exceljs";

const SOURCE = "../Risk_Miner_materialy_dla_uczestnikow_na_start/Risk_Miner_dane_projekty.xlsx";
const SOURCE_ID = process.env.DEMO_SOURCE_ID ?? "RM-2026-002";
const DEMO_ID = "RM-TEST-DEMO-001";

const input = new ExcelJS.Workbook();
await input.xlsx.readFile(SOURCE);
const sheet = input.worksheets[0];
const header = sheet.getRow(1).values;
const idCol = header.findIndex((v) => v === "Identyfikator rekordu");
let row;
sheet.eachRow((r, i) => {
  if (i > 1 && r.getCell(idCol).value === SOURCE_ID) row = r.values;
});
if (!row) throw new Error(`Nie znaleziono ${SOURCE_ID} w pliku organizatora`);
row[idCol] = DEMO_ID;
row[header.findIndex((v) => v === "Lp.")] = 1;
// Import pomija duplikaty po identyfikatorze publicznym — oryginał jest już w bazie, więc dopisek „-DEMO”.
const pubCol = header.findIndex((v) => v === "Identyfikator publiczny");
row[pubCol] = `${row[pubCol]}-DEMO`;

const output = new ExcelJS.Workbook();
const out = output.addWorksheet(sheet.name);
out.addRow(header.slice(1));
out.addRow(row.slice(1));
await output.xlsx.writeFile("demo/RM-TEST-demo.xlsx");
console.log(`demo/RM-TEST-demo.xlsx ← ${SOURCE_ID} jako ${DEMO_ID}`);
