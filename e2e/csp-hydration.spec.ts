import { expect, test, type Page } from "@playwright/test";

// Срочный фикс (сентябрь 2026): строгая CSP без нонса (script-src 'self') блокировала встроенные
// скрипты гидратации Next.js — сайт открывался, но ни одна кнопка не работала. Этот файл проверяет
// то же самое, что было бы видно человеку в браузере: реальные клики на собранном сайте
// (`next build && next start`, см. playwright.config.ts), и что в консоли браузера при этом нет
// ошибок CSP или гидратации. Раньше такой проверки не было — баг прошёл этап 10 незамеченным.
//
// Используется служебный переход /dev/quick-start, чтобы не отвечать на все ~110 вопросов теста
// ради проверки чекаута и админки: он доступен только когда NODE_ENV не «production» (см.
// src/lib/dev.ts) — CI на это специально указывает окружение (см. .github/workflows/e2e.yml),
// но сама сборка (`next build`) и все проверяемые страницы — точно такие же, как в бою.
// Сами клики по вопросам теста (обязательная часть проверки) проверяются отдельным тестом ниже
// без каких-либо сокращений.

const PASSWORD = "correct-horse-battery-9";

function uniqueLogin(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// Ошибки CSP и гидратации попадают в консоль браузера как console.error, а несовпадение разметки
// при гидратации иногда — как необработанное исключение страницы (pageerror). Остальные
// console.error (например, ожидаемый сетевой сбой в тесте на офлайн-режим) нас не интересуют.
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      /content security policy/i.test(text) ||
      /refused to (load|execute|apply)/i.test(text) ||
      /hydrat/i.test(text) ||
      /Minified React error #(418|419|421|422|423|425)/.test(text)
    ) {
      problems.push(`[console] ${text}`);
    }
  });
  page.on("pageerror", (err) => problems.push(`[pageerror] ${err.stack ?? err.message}`));
  return problems;
}

function assertNoProblems(problems: string[]) {
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("CSP с нонсом не блокирует гидратацию", () => {
  test("главная → старт → три ответа теста с автопереходом", async ({ page }) => {
    const problems = watchConsole(page);

    await page.goto("/");
    await page.locator('a[href="/start"]').first().click();
    await page.waitForURL("**/start");

    // Экран-развилка: первая кнопка пути (form action, требует гидратации формы).
    await page.locator('form button[name="pathType"]').first().click();
    await page.waitForURL("**/test");

    // Экран подготовки перед первым вопросом (ТЗ аудита §6, UX-09) — кнопка «Начать тест»
    // требует клиентского состояния (React), поэтому клик здесь тоже проверяет гидратацию.
    await page.getByRole("button", { name: /Testni boshlash|Начать тест/ }).click();

    // Один вопрос на экран, шкала-круги 1–5, автопереход к следующему (CLAUDE.md §5).
    for (let i = 0; i < 3; i++) {
      const heading = page.locator("h1[aria-live='polite']");
      await expect(heading).toBeVisible();
      const before = await heading.textContent();

      const options = page.getByRole("radiogroup").getByRole("radio");
      const middle = Math.min(2, (await options.count()) - 1);
      await options.nth(middle).click();

      // Автопереход происходит после короткой паузы (ADVANCE_DELAY_MS) — ждём смены вопроса.
      await expect(heading).not.toHaveText(before ?? "__unset__", { timeout: 5000 });
    }

    assertNoProblems(problems);
  });

  test("регистрация и вход", async ({ page }) => {
    const problems = watchConsole(page);
    const login = uniqueLogin("e2euser");

    await page.goto("/register");
    await page.locator('input[name="login"]').fill(login);
    await page.locator('input[name="password"]').fill(PASSWORD);
    // На каждой странице есть ещё форма переключателя языка (кнопки uz/ru) — сужаем до формы с паролем.
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click();

    // Код восстановления показывается один раз; кнопка «Продолжить» разблокируется чекбоксом
    // (клиентское состояние — хороший индикатор того, что гидратация отработала).
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    // Шапка сайта тоже содержит ссылку на /account — берём ту, что в содержимом страницы (последняя в DOM).
    await page.locator('a[href="/account"]').last().click();
    await page.waitForURL("**/account");

    // Выходим и входим обратно тем же логином и паролем.
    await page.locator('form:not(:has(button[name="locale"])) button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith("/account"));

    await page.goto("/login");
    await page.locator('input[name="login"]').fill(login);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
    await page.waitForURL("**/account");
    await expect(page.locator("body")).toContainText(login);

    assertNoProblems(problems);
  });

  // Требует SUPERADMIN_LOGINS=e2eadmin в окружении (см. .github/workflows/e2e.yml) — иначе /admin
  // не откроется этому пользователю.
  test("тизер → чекаут в тестовом режиме → /admin", async ({ page }) => {
    const problems = watchConsole(page);

    await page.goto("/dev/quick-start?path=knows_goal");
    await page.waitForURL("**/teaser", { timeout: 20_000 });

    const unlock = page.locator('a[href="/register?next=/checkout"]');
    await expect(unlock).toBeVisible({ timeout: 40_000 });
    await unlock.click();
    await page.waitForURL("**/register**");

    await page.locator('input[name="login"]').fill("e2eadmin");
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click();

    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await page.locator('a[href="/checkout"]').click();
    await page.waitForURL("**/checkout");

    // Уровень уже выбран (рекомендуемый по развилке) — просто оплачиваем.
    await page.locator('form:has(input[name="level"]) button[type="submit"]').click();
    await page.waitForURL("**/checkout/test/**", { timeout: 15_000 });

    await page.locator('button[name="outcome"][value="pay"]').click();
    await page.waitForURL("**/report/**", { timeout: 15_000 });

    // Полный отчёт генерируется в фоне (CLAUDE.md §7 «Фоновая генерация») — ждём готовности.
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45_000 });

    await page.goto("/admin");
    await expect(page.locator("body")).toContainText("e2eadmin");

    assertNoProblems(problems);
  });
});
