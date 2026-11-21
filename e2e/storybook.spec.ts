import { existsSync, readdirSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// Każda historia musi się wyrenderować bez błędu — w głównym Storybooku i w piaskownicach design-systems/*.
type Entry = { id: string; type: string; title: string; name: string };

const root = "public/storybook";
const sandboxes = existsSync(`${root}/ds`) ? readdirSync(`${root}/ds`) : [];
const books = [
  { label: "shadcn", dir: root, url: "/storybook" },
  ...sandboxes.map((name) => ({ label: name, dir: `${root}/ds/${name}`, url: `/storybook/ds/${name}` })),
].filter((book) => existsSync(`${book.dir}/index.json`));

test.skip(books.length === 0, "Brak public/storybook — uruchom `npm run build`.");

for (const book of books) {
  const entries: Entry[] = Object.values(JSON.parse(readFileSync(`${book.dir}/index.json`, "utf8")).entries);

  test.describe(book.label, () => {
    for (const entry of entries.filter((item) => item.type === "story")) {
      test(`${entry.title} › ${entry.name}`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));

        await page.goto(`${book.url}/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=story`);
        await expect(
          page.locator("#storybook-root > *, body > [data-radix-portal], body > [role=dialog]").first(),
        ).toBeAttached();
        await expect(page.locator(".sb-show-errordisplay")).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });
}
