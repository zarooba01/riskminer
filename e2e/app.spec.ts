import { expect, test } from "@playwright/test";

const password = process.env.SITE_PASSWORD;
const database = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY));

/** Przy włączonym haśle witryny logujemy się przez formularz /haslo. */
async function unlock(page: import("@playwright/test").Page) {
  if (!password) return;
  await page.goto("/haslo");
  await page.getByLabel("Hasło dostępu").fill(password);
  await page.getByRole("button", { name: "Wejdź" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("hasło witryny", () => {
  test.skip(!password, "SITE_PASSWORD nie jest ustawione — witryna otwarta.");

  test("bez hasła przekierowuje na /haslo, złe hasło odrzuca, dobre wpuszcza", async ({ page, request }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/haslo\?next=%2Fprojects$/);
    await page.getByLabel("Hasło dostępu").fill("zle-haslo");
    await page.getByRole("button", { name: "Wejdź" }).click();
    await expect(page.getByText("Nieprawidłowe hasło.")).toBeVisible();
    await page.getByLabel("Hasło dostępu").fill(password!);
    await page.getByRole("button", { name: "Wejdź" }).click();
    await expect(page).toHaveURL(/\/projects$/);

    expect((await request.get("/api/export/projects")).status()).toBe(401);
  });
});

test("strona startowa prowadzi do pulpitu i nawigacji", async ({ page, isMobile }) => {
  await unlock(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Risk Miner", level: 1 })).toBeVisible();

  const nav = isMobile ? page.getByRole("navigation", { name: "Nawigacja główna" }) : page.locator("[data-slot=sidebar]");
  for (const [link, heading] of [
    ["Projekty", "Projekty"],
    ["Weryfikacja", "Weryfikacja"],
    ["Modele", "Modele"],
    ["Nowa inwestycja", "Ocena nowej inwestycji"],
    ["Zapisane oceny", "Zapisane oceny"],
    ["Baza porównawcza", "Baza porównawcza"],
  ].filter(([link]) => !(isMobile && ["Modele", "Baza porównawcza"].includes(link)))) {
    // „Modele” i „Baza porównawcza” są za piątą pozycją — na telefonie tylko w pasku bocznym (dolny pasek mieści 5).
    await nav.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test.describe("dane (Supabase)", () => {
  test.skip(!database, "Brak kluczy bazy w .env.local.");

  test("ocena nowej inwestycji: podobne przypadki, ryzyka, eksport i usunięcie", async ({ page, request }) => {
    test.setTimeout(90_000);
    const tag = `RM-TEST-e2e-${Date.now()}`;
    await unlock(page);
    await page.goto("/assessments/new");
    await page.getByLabel("Opis planowanej inwestycji").fill(`${tag}: chcemy wybudować kanalizację sanitarną w Góraszce, woj. mazowieckie, ok. 3 km sieci, budżet 4 mln zł, 12 miesięcy. Znane warunki: kolizje z uzbrojeniem.`);
    await expect(page.getByLabel("Użyj modelu AI do analizy")).not.toBeChecked();
    await page.getByRole("button", { name: "Oceń inwestycję" }).click();
    await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: new RegExp(tag), level: 1 })).toBeVisible();
    await expect(page.getByText("Próba porównawcza")).toBeVisible();

    await page.getByRole("tab", { name: /Podobne inwestycje/ }).click();
    await expect(page.getByText("Dlaczego podobne:").first()).toBeVisible();
    await page.getByRole("tab", { name: /Ryzyka/ }).click();
    await expect(page.getByText("Sprawdź przed przetargiem").first()).toBeVisible();

    const id = page.url().split("/").pop()!;
    const json = await request.get(`/api/assessments/${id}/export?format=json`);
    expect(json.status()).toBe(200);
    const body = await json.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect((await request.get(`/api/assessments/${id}/export?format=csv&part=items`)).status()).toBe(200);
    expect((await request.get(`/api/export/assessment_items?format=json&assessment=${id}`)).status()).toBe(200);

    await page.goto("/assessments");
    await page.getByRole("button", { name: new RegExp(`Usuń ocenę ${tag}`) }).click();
    await expect(page.getByRole("link", { name: new RegExp(tag) })).toHaveCount(0);
  });

  test("projekt pokazuje KPI, ryzyka i źródło w szczegółach", async ({ page }) => {
    await unlock(page);
    await page.goto("/projects");
    await page.getByLabel("Szukaj projektów").fill("Godzikowice");
    await page.getByRole("link", { name: /Godzikowice/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Godzikowice");
    await expect(page.getByText("Umowa", { exact: true })).toBeVisible();
    await expect(page.getByText("Czas", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /Ryzyka/ }).click();
    await expect(page.getByText(/Wykonanie umowy po terminie/).first()).toBeVisible();
    await page.getByRole("tab", { name: "Szczegóły" }).click();
    await page.getByRole("button", { name: /Źródła i zapytania/ }).click();
    await expect(page.getByRole("link", { name: /2022\/BZP 00115288\/01/ }).first()).toBeVisible();
  });

  test("Steklin: plan i wykonanie, zmiany bez duplikatów, źródła i fragment w źródle", async ({ page }) => {
    await unlock(page);
    await page.goto("/projects/RM-2026-003");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Steklin");

    const plan = page.getByRole("region", { name: "Plan i wykonanie" });
    await expect(plan.getByText("Termin zakończenia")).toBeVisible();
    await expect(plan.getByText("Termin po zmianach umowy")).toBeVisible();
    await expect(plan.getByText("2 990 000 zł").first()).toBeVisible();

    // Przebieg: sprawdzone źródła (BZP + strona postępowania zamawiającego + TED)
    await page.getByRole("tab", { name: "Przebieg" }).click();
    await expect(page.getByText("Sprawdzone źródła")).toBeVisible();
    await expect(page.getByText("Strona postępowania zamawiającego (platforma zakupowa / BIP)")).toBeVisible();
    await expect(page.getByText("TED — Dziennik Urzędowy UE")).toBeVisible();

    // Szczegóły: trzy zmiany umowy (ta sama zmiana z ogłoszenia o zmianie i o wykonaniu umowy tylko raz)
    await page.getByRole("tab", { name: "Szczegóły" }).click();
    await expect(page.getByText("Zmiany umowy (3)")).toBeVisible();

    // Ryzyka: opóźnienie z przyczyną z aneksu i jawny brak danych o czasie przy zmianie z kwotą
    await page.getByRole("tab", { name: /Ryzyka/ }).click();
    await page.getByRole("button", { name: /R06 Wykonanie umowy po terminie/ }).click();
    await expect(page.getByText(/pozwolenia wodnoprawnego/).first()).toBeVisible();
    await page.getByRole("button", { name: /Zmiana umowy nr 1/ }).click();
    await expect(page.getByText(/czas: brak danych/).first()).toBeVisible();

    // Kliknięcie źródła: podgląd z zaznaczonym fragmentem
    await page.getByRole("link", { name: /pokaż fragment/ }).first().click();
    await expect(page).toHaveURL(/\/sources\//);
    await expect(page.getByText("Zaznaczony fragment, na którym oparto ustalenie:")).toBeVisible();
    await expect(page.locator("mark#fragment")).toBeVisible();
    await page.getByRole("link", { name: "Wróć do projektu" }).click();
    await expect(page).toHaveURL(/\/projects\/RM-2026-003$/);
  });

  test("eksport JSON i CSV", async ({ page }) => {
    await unlock(page);
    const json = await page.request.get("/api/export/contracts?format=json");
    expect(json.ok()).toBe(true);
    const body = await json.json();
    expect(body.entity).toBe("contracts");
    expect(Array.isArray(body.rows)).toBe(true);

    const csv = await page.request.get("/api/export/events?format=csv");
    expect(csv.headers()["content-type"]).toContain("text/csv");
  });
});

test("szablon pliku z projektami (XLSX i CSV) ma nagłówki z definicji kolumn", async ({ page }) => {
  await unlock(page);
  const csv = await page.request.get("/api/projects/template?format=csv");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const header = (await csv.text()).replace(/^\uFEFF/, "").trim().split(";");
  expect(header).toHaveLength(23);
  expect(header).toContain("Identyfikator rekordu");
  expect(header).toContain("Nazwa przedsięwzięcia");

  const xlsx = await page.request.get("/api/projects/template?format=xlsx");
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  expect(xlsx.headers()["content-disposition"]).toContain("riskminer_szablon_projektow.xlsx");
});

test("prezentacja przechodzi między slajdami", async ({ page, isMobile }) => {
  await unlock(page);
  await page.goto("/pitch");
  await expect(page.locator(".reveal.ready")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  test.skip(isMobile, "Nawigację klawiaturą sprawdzamy na desktopie.");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#\/1$/);
  await expect(page.getByRole("heading", { name: "Problem" })).toBeVisible();
});
