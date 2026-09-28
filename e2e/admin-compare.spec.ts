import { expect, test, type Page } from "@playwright/test";

// Слепое сравнение моделей (/admin/compare, только superadmin): реальные клики на собранном сайте
// в тестовом режиме ИИ (AI_MODE=mock) — форма, оценка стоимости, генерация двух вариантов с опросом
// статуса, оценка → раскрытие моделей → сводка побед.
//
// Требует SUPERADMIN_LOGINS со значением e2ecompare (см. .github/workflows/e2e.yml) — отдельный
// суперадмин, чтобы не зависеть от порядка файлов с e2e/csp-hydration.spec.ts (там e2eadmin).

const LOGIN = "e2ecompare";
const PASSWORD = "correct-horse-battery-9";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(LOGIN);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname.startsWith("/account")) return;
  // Первый запуск на чистой базе — аккаунта ещё нет: регистрируем.
  await page.goto("/register");
  await page.locator('input[name="login"]').fill(LOGIN);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  const checkbox = page.locator('input[type="checkbox"]');
  await expect(checkbox).toBeVisible();
  await checkbox.check();
  await page.locator('a[href="/account"]').last().click();
  await page.waitForURL("**/account");
}

async function runComparison(page: Page, options: { kind: string; part?: string; source: string }) {
  await page.goto("/admin/compare");
  await page.locator(`input[name="source"][value="${options.source}"]`).check();
  await page.locator('select[name="kind"]').selectOption(options.kind);
  if (options.part) await page.locator('select[name="part"]').selectOption(options.part);
  await page.locator('input[name="model1"]').fill("claude-sonnet-5");
  await page.locator('input[name="model2"]').fill("gpt-6-sol");
  // Оценка стоимости пересчитывается на лету по ценам прайса (клиентское состояние — гидратация работает).
  await expect(page.getByTestId("compare-estimate")).toContainText("$");
  await page.locator('input[name="model2"]').fill("gpt-unknown-model");
  await expect(page.getByTestId("compare-estimate")).toContainText("нет в прайсе");
  await page.locator('input[name="model2"]').fill("gpt-6-sol");

  await page.getByRole("button", { name: "Запустить сравнение" }).click();
  await page.waitForURL(/\/admin\/compare\?id=/);

  // Обе генерации идут отдельными запросами, страница опрашивает статус и перерисовывается сама.
  await expect(page.locator("#variant-1")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator("#variant-2")).toBeVisible();
  // До оценки названий моделей нет ни в вариантах, ни в форме оценки (в сводке внизу — только
  // уже оценённые прошлые сравнения).
  for (const block of [page.locator("#variant-1"), page.locator("#variant-2"), page.locator("#rating")]) {
    await expect(block).not.toContainText("gpt-6-sol");
    await expect(block).not.toContainText("claude-sonnet-5");
  }

  await page.locator('input[name="verdict"][value="1"]').check();
  await page.locator('textarea[name="comment"]').fill("e2e: первый вариант естественнее");
  await page.getByRole("button", { name: "Сохранить оценку и показать модели" }).click();

  const reveal = page.getByTestId("compare-reveal");
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("gpt-6-sol");
  await expect(reveal).toContainText("claude-sonnet-5");
  await expect(reveal).toContainText("лучше Variant 1");
  await expect(page.getByTestId("compare-summary")).toContainText("gpt-6-sol");
}

test.describe("/admin/compare — слепое сравнение моделей", () => {
  test("тизер: форма → два варианта → оценка → раскрытие моделей → сводка", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await signIn(page);
    await runComparison(page, { kind: "teaser", source: "golden" });
    // Тизер показан тем же компонентом, что видит пользователь (узбекский интерфейс вокруг).
    await expect(page.locator("#variant-1 h1").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("часть отчёта «Навигатор» (portrait_goal) без цели", async ({ page }) => {
    await signIn(page);
    await runComparison(page, { kind: "report_navigator", part: "portrait_goal", source: "golden_no_goal" });
    await expect(page.locator("#variant-2 #portrait")).toBeVisible();
  });

  test("/admin/prompts: модель OpenAI без OPENAI_API_KEY не сохраняется, узбекский ключ отчёта есть", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/prompts");
    const form = page.locator('form:has(input[name="key"][value="report_route_uz"])');
    await expect(form).toContainText("только узбекский");
    await form.locator('input[name="model"]').fill("gpt-6-sol");
    await form.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.locator("body")).toContainText("нет ключа OPENAI_API_KEY");
    // Ничего не сохранилось: поле по-прежнему пустое (используется модель уровня).
    await expect(page.locator('form:has(input[name="key"][value="report_route_uz"]) input[name="model"]')).toHaveValue("");
  });

  test("обычный пользователь не видит страницу", async ({ page }) => {
    const response = await page.goto("/admin/compare");
    expect(response?.status()).toBe(404);
  });
});
