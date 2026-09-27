import { defineConfig, devices } from "@playwright/test";

// e2e-проверка (срочный фикс CSP, сентябрь 2026): реальные клики в браузере на собранном сайте
// (`next build && next start`), а не через SSR/dev-сервер — именно на такой сборке строгая CSP без
// нонса блокировала гидратацию. Запускается через `npm run test:e2e` (README/CI).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // В некоторых средах уже стоит Chromium другой ревизии, чем ждёт эта версия Playwright
        // (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 не даёт скачать нужную). В GitHub Actions (см.
        // .github/workflows/e2e.yml) эта переменная не задана — там ставится обычный `npx playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : undefined,
      },
    },
  ],
});
