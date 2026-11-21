import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const port = 3100;
// E2E_BASE_URL=https://… uruchamia testy na wdrożonej aplikacji zamiast na lokalnym buildzie.
const remote = process.env.E2E_BASE_URL;

// Testy działają na buildzie produkcyjnym: najpierw `npm run build`, potem `npm run test:e2e`.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: remote ?? `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "telefon", use: { ...devices["Pixel 7"] }, testIgnore: /storybook/ },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
      },
});
