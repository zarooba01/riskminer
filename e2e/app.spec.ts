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
    ["Modele", "Porównanie modeli"],
    ["Eksport", "Eksport"],
  ]) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test.describe("dane (Supabase)", () => {
  test.skip(!database, "Brak kluczy bazy w .env.local.");

  test("projekt pokazuje umowę ze źródłem i zdarzenia", async ({ page }) => {
    await unlock(page);
    await page.goto("/projects");
    await page.getByLabel("Szukaj projektów").fill("Godzikowice");
    await page.getByRole("link", { name: /Godzikowice/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Godzikowice");
    await expect(page.getByText("Wartość umowy (brutto)")).toBeVisible();
    await expect(page.getByRole("link", { name: /2022\/BZP 00115288\/01/ }).first()).toBeVisible();
    await page.getByRole("tab", { name: /Zdarzenia ryzyka/ }).click();
    await expect(page.getByText(/Wykonanie umowy po terminie/).first()).toBeVisible();
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
