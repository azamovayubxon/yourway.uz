import { expect, test, type Browser, type Page } from "@playwright/test";
import { ru } from "../src/i18n/dictionaries/ru";
import { uz } from "../src/i18n/dictionaries/uz";
import { fmt } from "../src/i18n/format";

// Этап 3 (новый стиль): оплата → «отчёт пишется» → отчёт → PDF → кабинет реальными кликами на
// собранном сайте (тестовый режим ИИ и оплаты), на узбекском и русском, на телефоне (390) и
// компьютере (1280). Один аккаунт на язык проходит обе ширины — регистраций с одного IP в час
// ограниченное число (AUTH_REGISTER_PER_IP_PER_HOUR), а суть проверки — вёрстка и клики, не сам вход.
//
// Промокод на 50% заводит суперадмин e2ehome (тот же, что в e2e/home.spec.ts и e2e/share.spec.ts)
// в /admin/promo — в тестовых данных готовых промокодов нет. Скидка 50%, а не 100%: при нулевой
// сумме тестовая страница оплаты пропускается, а её здесь тоже нужно пройти.

const PASSWORD = "correct-horse-battery-9";
const ADMIN_LOGIN = "e2ehome";

function uniqueLogin(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}`;
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `горизонтальное переполнение на «${label}»: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth + 1,
  );
}

// Проверка на 375 px (CLAUDE.md §3) — той же страницы, без перезагрузки данных.
async function assertNoOverflowAt375(page: Page, label: string) {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page, `${label}, 375px`);
  await page.setViewportSize(size);
}

async function createPromo(browser: Browser, code: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(ADMIN_LOGIN);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  if (!new URL(page.url()).pathname.startsWith("/account")) {
    // Первый запуск на чистой базе — аккаунта ещё нет: регистрируем.
    await page.goto("/register");
    await page.locator('input[name="login"]').fill(ADMIN_LOGIN);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await page.locator('a[href="/account"]').last().click();
    await page.waitForURL("**/account");
  }
  await page.goto("/admin/promo");
  await page.locator('input[name="code"]').fill(code);
  await page.locator('input[name="percent"]').fill("50");
  await page.getByRole("button", { name: "Создать" }).click();
  await page.waitForURL("**/admin/promo?ok=1");
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await context.close();
}

for (const locale of ["uz", "ru"] as const) {
  const t = locale === "uz" ? uz : ru;
  const r = t.report;
  const a = t.auth.account;

  test(`оплата → «отчёт пишется» → отчёт → PDF → кабинет [${locale}, 390 и 1280]`, async ({ browser }) => {
    test.setTimeout(180_000);
    const promo = `E2E3${locale.toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
    await createPromo(browser, promo);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3000" }]);
    const page = await context.newPage();

    // Тизер (сессия «без цели») → регистрация → checkout.
    await page.goto("/dev/quick-start?path=no_goal");
    await page.waitForURL("**/teaser", { timeout: 20_000 });
    await page.locator('a[href="/register?next=/checkout"]').click();
    await page.waitForURL("**/register**");
    await page.locator('input[name="login"]').fill(uniqueLogin(`s3${locale}`));
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
    await page.locator('input[type="checkbox"]').check();
    await page.locator('a[href="/checkout"]').click();
    await page.waitForURL("**/checkout");

    // ── Оплата ──
    await expect(page.getByText(t.checkout.kicker)).toBeVisible();
    await expect(page.getByText(t.checkout.recommended)).toBeVisible();
    await page.locator('input[name="level-choice"][value="route"]').check();
    // У выбранного пакета видны пункты PACKAGE_FEATURES.
    await expect(page.getByText(t.checkout.levels.route.features[0]!, { exact: true })).toBeVisible();
    const payButton = page.locator('form:has(input[name="level"]) button[type="submit"]');
    await expect(payButton).toBeDisabled();
    const goalPicker = page.getByRole("radiogroup", { name: t.checkout.goalPicker.title });
    await goalPicker.locator("label").first().click();
    await expect(goalPicker.locator("input").first()).toBeChecked();
    await expect(payButton).toBeEnabled();

    // Язык отчёта: переключаем на другой и обратно — выбор виден по aria-pressed.
    const other = t.checkout.reportLanguageNames[locale === "uz" ? "ru" : "uz"];
    const own = t.checkout.reportLanguageNames[locale];
    await page.getByRole("button", { name: other, exact: true }).click();
    await expect(page.getByRole("button", { name: other, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: own, exact: true }).click();
    await expect(page.getByRole("button", { name: own, exact: true })).toHaveAttribute("aria-pressed", "true");

    // Промокод: ссылка раскрывает поле, скидка меняет сумму на кнопке.
    const fullPrice = await payButton.innerText();
    await page.getByRole("button", { name: t.checkout.promoToggle }).click();
    await page.locator("#promo").fill(promo);
    await page.getByRole("button", { name: t.checkout.promoApply }).click();
    await expect(page.getByText(fmt(t.checkout.promoApplied, { p: 50 }))).toBeVisible();
    await expect(payButton).not.toHaveText(fullPrice);
    await assertNoHorizontalOverflow(page, "checkout");
    await assertNoOverflowAt375(page, "checkout");

    // Тестовая оплата: видна скидка по промокоду.
    await payButton.click();
    await page.waitForURL("**/checkout/test/**", { timeout: 15_000 });
    await expect(page.getByText(t.testPay.discount)).toBeVisible();
    await assertNoHorizontalOverflow(page, "тестовая оплата");
    await page.locator('button[name="outcome"][value="pay"]').click();
    await page.waitForURL("**/report/**", { timeout: 15_000 });
    const reportId = page.url().split("/report/")[1]!.split(/[?#]/)[0]!;

    // ── «Отчёт пишется»: части меняют состояние по данным сервера ──
    await expect(page.getByText(r.generating.paid)).toBeVisible();
    const current = page.locator('li[aria-current="step"]');
    await expect(current).toContainText(r.generating.steps[0]!);
    await expect(current).toContainText(r.generating.stepWriting);
    await expect(current).toContainText(r.generating.steps[1]!, { timeout: 30_000 });
    // Первая часть теперь готова (бирюзовая галочка, для читалок — «tayyor»/«готово»).
    await expect(page.locator("li", { hasText: r.generating.steps[0]! })).toContainText(r.generating.stepDone);
    await assertNoHorizontalOverflow(page, "отчёт пишется");

    // ── Готовый отчёт, телефон ──
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByText(r.firstScreen.title)).toBeVisible();
    await assertNoHorizontalOverflow(page, "отчёт");
    await assertNoOverflowAt375(page, "отчёт");

    // Плавающая кнопка «Boʻlimlar · n/total» открывает список разделов и ведёт к разделу.
    const sections = page.locator("summary", { hasText: r.sectionsButton });
    await expect(sections).toBeVisible();
    await sections.click();
    const menuLinks = page.locator("details ol a");
    const total = await menuLinks.count();
    expect(total).toBeGreaterThanOrEqual(8);
    await menuLinks.filter({ hasText: r.sections.plan30 }).click();
    await expect(page.locator("#plan30")).toBeInViewport();
    await expect(menuLinks.first()).toBeHidden(); // меню закрылось после выбора
    const plan30Index = (await page.locator("section[id]").evaluateAll((els) => els.map((e) => e.id))).indexOf("plan30") + 1;
    await expect(sections).toContainText(`${plan30Index}/${total}`);

    // Галочка в «30 kunlik reja» сохраняется после перезагрузки (localStorage).
    const box = page.locator("#plan30 input[type=checkbox]").first();
    await box.check();
    await expect(box).toBeChecked();
    await page.reload();
    await expect(page.locator("#plan30 input[type=checkbox]").first()).toBeChecked();
    await expect(page.locator("#plan30 input[type=checkbox]").nth(1)).not.toBeChecked();

    // PDF — настоящий клик по ссылке в шапке отчёта и скачивание.
    const pdfLink = page.locator('a[href*="/pdf"]').first();
    await expect(pdfLink).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), pdfLink.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const pdfPath = await download.path();
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(pdfPath!).subarray(0, 5).toString()).toBe("%PDF-");

    // ── Готовый отчёт, компьютер: оглавление слева и «Oʻqildi» ──
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/report/${reportId}`);
    await assertNoHorizontalOverflow(page, "отчёт 1280");
    const toc = page.getByRole("navigation", { name: r.toc });
    await expect(toc).toBeVisible();
    await expect(sections).toBeHidden();
    await expect(page.getByRole("link", { name: r.downloadPdf }).first()).toBeVisible();
    const readRe = new RegExp(fmt(r.readProgress, { n: "(\\d+)", total: String(total) }).replace(/[/]/g, "\\/"));
    const readText = toc.getByText(readRe);
    const readNow = async () => Number((await readText.innerText()).match(readRe)![1]);
    const before = await readNow();
    expect(before).toBeLessThan(total);
    // Оглавление ведёт к разделу, активный пункт подсвечен.
    await toc.locator('a[href="#path"]').click();
    await expect(page.locator("#path")).toBeInViewport();
    await expect(toc.locator('a[href="#path"]')).toHaveAttribute("aria-current", "location");
    // Счётчик растёт при прокрутке — до конца отчёта прочитаны все разделы.
    await expect.poll(readNow).toBeGreaterThan(before);
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 900);
    await expect.poll(readNow).toBe(total);

    // ── Кабинет: компьютер и телефон ──
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
      await page.goto("/account");
      await assertNoHorizontalOverflow(page, `кабинет ${width}`);
      await expect(page.getByText(a.lastResultTitle)).toBeVisible();
      await expect(page.getByRole("link", { name: a.openResult })).toHaveAttribute("href", "/teaser");
      const open = page.locator(`a[href="/report/${reportId}"]`);
      await expect(open).toHaveCount(1);
      await expect(open).toHaveText(a.open);
      await expect(page.locator(`a[href="/api/report/${reportId}/pdf"]`)).toBeVisible();
      await expect(page.getByText(a.reportStatus.ready)).toBeVisible();
      // Куплен только «Маршрут» — предложение «Навигатора» с ценой из базы.
      await expect(page.locator('a[href="/checkout"]', { hasText: t.checkout.levels.navigator.name })).toBeVisible();
      await expect(page.getByRole("link", { name: a.retake })).toHaveAttribute("href", "/start?new=1");
    }
    await assertNoOverflowAt375(page, "кабинет");
    await context.close();
  });
}
