// Nagranie filmu demo Risk Minera (≤ 3 min) — Playwright steruje lokalną aplikacją.
//   DEMO_RECORD=1  nagrywa wideo do demo/out/ (domyślnie 1)
//   DEMO_AI=1      wykonuje płatny krok AI (dodanie dokumentu z analizą; domyślnie 0)
//   DEMO_HEADED=1  widoczne okno przeglądarki
//   DEMO_BASE_URL  domyślnie http://localhost:3000
// Po nagraniu: bash demo/postprocess.sh, a na koniec bash demo/cleanup.sh (usuwa tylko RM-TEST-DEMO-*).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { overlayScript } from "./overlay.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const RECORD = process.env.DEMO_RECORD !== "0";
const AI = process.env.DEMO_AI === "1";
const OUT = path.resolve("demo/out");
const VIEW = { width: 1600, height: 900 };
const PROJECT_ID = "RM-TEST-DEMO-001";
const DOC = path.resolve("../Risk_Miner_protokol_konieczności_aneksowania_zagrodno.pdf");
const LOGO = `data:image/png;base64,${readFileSync(path.resolve("../riskminerlogo.png")).toString("base64")}`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: process.env.DEMO_HEADED !== "1" });
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 1,
  locale: "pl-PL",
  acceptDownloads: true,
  ...(RECORD ? { recordVideo: { dir: OUT, size: VIEW } } : {}),
});
await context.addInitScript(overlayScript);
const page = await context.newPage();
const t0 = Date.now();
page.setDefaultTimeout(20_000);

// ── znaczniki czasu dla postprodukcji ──────────────────────────────────────────
const timeline = { waits: [], scenes: [] };
const now = () => (Date.now() - t0) / 1000;
const scene = (name) => {
  timeline.scenes.push({ name, at: now() });
  console.log(`[${now().toFixed(1)}s] ${name}`);
};
async function fastForward(label, fn) {
  const start = now();
  await page.evaluate((t) => window.__demoChip?.(t), "⏩ przyspieszono");
  try {
    return await fn();
  } finally {
    await page.evaluate(() => window.__demoChip?.("")).catch(() => {});
    timeline.waits.push({ label, start, end: now() });
  }
}

// ── pomocnicze ─────────────────────────────────────────────────────────────────
// Tempo: 1 = pauzy jak w scenariuszu, mniej = szybciej (cel: film 2:00–2:15).
const PACE = Number(process.env.DEMO_PACE ?? 0.8);
const hold = (ms) => page.waitForTimeout(Math.round(ms * PACE));
async function caption(title, sub = "") {
  const html = sub ? `${title}<small>${sub}</small>` : title;
  await page.evaluate((h) => window.__demoSetCaption?.(h), html).catch(() => {});
}
async function point(locator, ms = 700) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await page.evaluate((r) => window.__demoHighlight?.(r), box);
  await hold(ms);
}
async function click(locator, ms = 600) {
  await point(locator, ms);
  await page.evaluate(() => window.__demoHighlight?.(null));
  await locator.click();
}
async function showcase(locator, ms = 1800) {
  await point(locator, ms);
  await page.evaluate(() => window.__demoHighlight?.(null));
}
async function scrollBy(dy, ms = 900) {
  await page.mouse.wheel(0, dy);
  await hold(ms);
}
async function goto(url) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
}
async function visible(locator, timeout = 3000) {
  return locator.first().isVisible({ timeout }).catch(() => false) || locator.first().waitFor({ timeout }).then(() => true, () => false);
}
async function card(title, sub) {
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center">
    <img src="${LOGO}" style="height:150px;margin-bottom:28px;border-radius:24px">
    <h1 style="font-size:64px;margin:0 0 14px">${title}</h1>
    <p style="font-size:28px;opacity:.85;max-width:1100px;margin:0">${sub}</p></body></html>`);
}

async function unlock() {
  const password = process.env.SITE_PASSWORD;
  if (!password) return;
  await page.goto(`${BASE}/haslo`);
  await page.getByLabel("Hasło dostępu").fill(password);
  await page.getByRole("button", { name: "Wejdź" }).click();
  await page.waitForURL(/\/dashboard$/);
}

// ══ SCENARIUSZ ════════════════════════════════════════════════════════════════
try {
  // 1. Wstęp
  scene("1 tytuł");
  await card("Risk Miner", "Inteligentna baza doświadczeń inwestycji publicznych<br>pilotaż: sektor wodno-kanalizacyjny · HackNation 2026 · MFiPR");
  await hold(3500);
  await unlock();
  await goto("/dashboard");
  await caption("Pulpit: baza zrealizowanych inwestycji wod-kan", "projekt → postępowanie → ogłoszenia → umowa → zmiany → zdarzenia ryzyka");
  await hold(3000);

  // 2. Import i automatyczne wzbogacenie
  scene("2 import");
  await goto("/projects");
  await caption("Ścieżka 1: import rekordu z pliku organizatora (XLSX)", "rekord KPO bez numeru ogłoszenia — system sam szuka przetargu w BZP");
  await hold(1500);
  await click(page.getByRole("button", { name: "Importuj inwestycje" }));
  const importDialog = page.getByRole("dialog");
  await importDialog.getByLabel("Plik .xlsx lub .csv").setInputFiles(path.resolve("demo/RM-TEST-demo.xlsx"));
  await hold(800);
  await click(importDialog.getByRole("button", { name: "Importuj inwestycje" }));
  await caption("Import → wyszukiwanie w BZP (NIP, nazwa, CPV) → wzbogacenie", "ogłoszenia, wynik, zmiany i wykonanie umowy pobierane automatycznie");
  await fastForward("import+BZP", () => importDialog.getByRole("button", { name: "Zamknij" }).waitFor({ timeout: 240_000 }));
  await hold(2200);
  await click(importDialog.getByRole("button", { name: "Zamknij" }));

  // 3. Dopasowanie z pewnością i decyzja eksperta
  scene("3 dopasowanie");
  await goto(`/projects/${PROJECT_ID}`);
  await caption("Dopasowanie do przetargu: pewność i podstawa", "bez wspólnego klucza: NIP + podobieństwo nazwy, CPV, wzmianka o KPO");
  const matchButton = page.getByRole("button", { name: /^(Dopasuj|Wskaż przetarg)$/ });
  if (await visible(matchButton, 4000)) {
    await click(matchButton.first());
    const md = page.getByRole("dialog");
    await showcase(md.getByText(/Pewność:/).first(), 2500);
    await caption("Ekspert potwierdza niepewne dopasowanie", "albo odrzuca / wskazuje inny przetarg numerem BZP");
    const confirm = md.getByRole("button", { name: "Potwierdź" });
    if (await visible(confirm, 2000)) {
      await click(confirm);
      await fastForward("budowa rekordów po potwierdzeniu", () => md.waitFor({ state: "hidden", timeout: 180_000 }));
      await page.waitForLoadState("networkidle").catch(() => {});
    } else {
      await page.keyboard.press("Escape");
    }
  } else {
    await page.getByRole("tab", { name: "Szczegóły" }).click();
    await showcase(page.getByText(/Pewność \d+%/).first(), 3000);
  }

  // 4. Kompletny przypadek
  scene("4 przypadek");
  await goto(`/projects/${PROJECT_ID}`);
  await caption("Odtworzony przebieg: umowa, wypłata, termin, aneksy", "dane źródłowe vs obliczenia — każde oznaczone");
  await showcase(page.getByText("Plan i wykonanie").first(), 3000);
  await click(page.getByRole("tab", { name: /^Przebieg/ }));
  await caption("Ogłoszenia z BZP powiązane po OCID", "o zamówieniu → wynik → zmiany umowy → wykonanie umowy");
  await hold(1500);
  await scrollBy(400, 1500);
  const sourcesSection = page.getByText("Sprawdzone źródła").first();
  if (await visible(sourcesSection, 2000)) {
    await caption("Źródła dodatkowe: strona zamawiającego (BIP / platforma), TED", "sprawdzenie krzyżowe numeru BZP i wartości umowy");
    await showcase(sourcesSection, 3000);
  }

  // 5. Zdarzenie ryzyka → fragment źródła
  scene("5 źródło");
  await page.evaluate(() => window.scrollTo(0, 0));
  await click(page.getByRole("tab", { name: /^Ryzyka/ }));
  await caption("Zdarzenia ryzyka wg katalogu eksperckiego R01–R15", "przyczyna, wpływ na koszt i czas, cytat dosłowny ze źródła — status: do weryfikacji");
  const eventToggle = page.getByRole("button", { name: / — (do weryfikacji|zatwierdzone)$/ }).first();
  await click(eventToggle);
  await hold(2000);
  const fragment = page.getByRole("link", { name: /pokaż fragment/ }).first();
  await caption("Każdy wniosek prowadzi do źródła", "podgląd ogłoszenia z zaznaczonym fragmentem + link do oryginału");
  await click(fragment);
  await page.waitForURL(/\/sources\//);
  await page.waitForLoadState("networkidle").catch(() => {});
  await hold(800);
  await showcase(page.locator("mark#fragment").first(), 3500);
  await click(page.getByRole("link", { name: "Wróć do inwestycji" }).or(page.getByRole("button", { name: "Wróć do inwestycji" })).first());
  await page.waitForURL(/\/projects\//);

  // 6. Nowy dokument → ponowna analiza
  scene("6 dokument");
  await caption("Nowy dokument (PDF/DOCX) → ponowna analiza sprawy", "protokół konieczności aneksowania — porównanie z danymi z BZP");
  await click(page.getByRole("button", { name: "Akcje inwestycji" }));
  await click(page.getByRole("menuitem", { name: "Dodaj dokument" }));
  const docDialog = page.getByRole("dialog");
  await docDialog.getByLabel("Plik").setInputFiles(DOC);
  await click(docDialog.getByRole("combobox").first());
  await click(page.getByRole("option", { name: "protokół konieczności" }));
  if (AI) {
    await click(docDialog.getByRole("button", { name: "Dodaj i przeanalizuj" }));
    await fastForward("odczyt + analiza AI", () => docDialog.getByRole("button", { name: "Zamknij" }).waitFor({ timeout: 240_000 }));
    await hold(1500);
    await click(docDialog.getByRole("button", { name: "Zamknij" }));
    await page.waitForLoadState("networkidle").catch(() => {});
    await click(page.getByRole("tab", { name: /^Ryzyka/ }));
    await caption("Raport „co się zmieniło”: nowe / zmienione / usunięte ustalenia", "decyzje eksperta zachowane; ustalenia AI czekają na zatwierdzenie");
    await showcase(page.getByText("Co się zmieniło po ostatniej analizie").first(), 4000);
  } else {
    await hold(1500);
    await page.keyboard.press("Escape");
    await hold(500);
    const cancel = docDialog.getByRole("button", { name: /Anuluj|Zamknij/ });
    if (await visible(cancel, 500)) await cancel.first().click();
  }

  // 7. Panel eksperta
  scene("7 ekspert");
  await goto("/review?tab=events");
  await caption("Panel eksperta: zatwierdź, popraw, odrzuć, oznacz jako wzorcowe", "zatwierdzone przykłady trafiają do kolejnych analiz");
  await hold(1200);
  const reviewToggle = page.getByRole("button", { name: / — do weryfikacji$/ }).first();
  if (await visible(reviewToggle, 3000)) {
    await click(reviewToggle);
    await hold(1500);
  }
  await click(page.getByRole("tab", { name: /^Katalog/ }));
  await caption("Katalog zdarzeń i wiedza ekspercka — edycja bez zmian w kodzie", "co sprawdzić, działania, zapisy umowne dla każdej kategorii");
  await click(page.getByRole("button", { name: /^Wiedza ekspercka/ }).first());
  await hold(3000);
  await click(page.getByRole("dialog").getByRole("button", { name: "Anuluj" }));

  // 8. Ocena nowej inwestycji
  scene("8 ocena");
  await goto("/assessments/new");
  await caption("Ścieżka 2: ocena nowej inwestycji", "opis zwykłym językiem lub dokumenty PDF/DOCX");
  const description = page.getByLabel("Opis planowanej inwestycji");
  await point(description, 500);
  await description.pressSequentially(
    "RM-TEST-DEMO: Chcemy wybudować kanalizację sanitarną w Góraszce, woj. mazowieckie, ok. 3 km sieci, budżet 4 mln zł, 12 miesięcy. Znane warunki: kolizje z uzbrojeniem.",
    { delay: 6 },
  );
  await hold(800);
  await click(page.getByRole("button", { name: "Oceń inwestycję" }));
  await fastForward("ocena", () => page.waitForURL(/\/assessments\/[0-9a-f-]{36}$/, { timeout: 90_000 }));
  await page.waitForLoadState("networkidle").catch(() => {});
  await caption("Prognoza kosztu i terminu z przedziałami (P25–P75)", "liczebność próby n i poziom niepewności — „Obliczenie”, nie wniosek modelu");
  await hold(2500);
  await scrollBy(450, 2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await click(page.getByRole("tab", { name: /^Podobne inwestycje/ }));
  await caption("Podobne zakończone inwestycje i dlaczego", "podsektor, rodzaj robót, zakres (TF-IDF opisu), skala, województwo — wkład każdej cechy");
  await showcase(page.getByText("Dlaczego podobne:").first(), 3000);
  await click(page.getByRole("tab", { name: /^Ryzyka i zalecenia/ }));
  await caption("Ryzyka, czerwone flagi, co sprawdzić przed przetargiem, zapisy umowne", "w ilu z N umów wystąpiło + cytaty z linkiem do źródła");
  await showcase(page.getByText("Sprawdź przed przetargiem").first(), 2500);
  await scrollBy(500, 2000);

  // 9. Eksport i konfiguracja
  scene("9 eksport");
  await page.evaluate(() => window.scrollTo(0, 0));
  await caption("Wynik zapisany jako rekordy: filtrowanie, aktualizacja, eksport JSON/CSV");
  await click(page.getByRole("button", { name: "Akcje oceny" }));
  const download = page.waitForEvent("download");
  await click(page.getByRole("menuitem", { name: "Cała ocena (JSON)" }));
  const file = await download;
  await file.saveAs(path.join(OUT, file.suggestedFilename()));
  await hold(1200);
  await goto("/llm");
  await caption("Model AI z konfiguracji (AI Gateway): koszt, czas, precyzja vs decyzje eksperta", "zmiana modelu bez zmian w kodzie");
  await hold(2500);
  await caption("");
  await card("Risk Miner", "Dane źródłowe · obliczenia · wnioski modelu — zawsze z decyzją eksperta");
  await hold(3000);
  scene("koniec");
} catch (error) {
  console.error("Błąd scenariusza:", error);
  await page.screenshot({ path: path.join(OUT, "error.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2));
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const target = path.join(OUT, "raw.webm");
    renameSync(await video.path(), target);
    console.log(`Wideo: ${target} (${now().toFixed(1)} s surowego nagrania)`);
  }
}
