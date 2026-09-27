import { expect, test, type Page } from "@playwright/test";

// Этап C2 (ТЗ аудита §14, §15 этап C пункт 4): мобильная приёмка сверх того, что уже проверяет
// e2e/b2-funnel.spec.ts (360/390/768/1440 px без горизонтального переполнения на всём пути тизер→
// →отчёт, RU и UZ). Здесь — то, что b2-funnel не проверял: ширина 430×932 (частый профиль
// современных телефонов), увеличение текста до 200%, клавиатурная навигация по тесту и то, что
// фокус после ответа переходит на заголовок нового вопроса, а не остаётся на кнопке прежнего.

const VIEWPORT_430 = { width: 430, height: 932 };

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `горизонтальное переполнение на «${label}»: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth + 1,
  );
}

for (const locale of ["ru", "uz"] as const) {
  test(`430×932 без горизонтального переполнения: главная, тест, отчёт-тизер [${locale}]`, async ({ page, context }) => {
    test.setTimeout(60_000);
    await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3000" }]);
    await page.setViewportSize(VIEWPORT_430);

    await page.goto("/");
    await assertNoHorizontalOverflow(page, "главная");

    await page.goto("/start");
    await page.locator('button[name="pathType"]').first().click();
    await page.waitForURL("**/test");
    const startBtn = page.getByRole("button", { name: /Начать тест|Testni boshlash/ });
    if (await startBtn.count()) await startBtn.click();
    await assertNoHorizontalOverflow(page, "тест");

    await page.goto("/dev/quick-start?path=knows_goal");
    await page.waitForURL("**/teaser", { timeout: 20_000 });
    await expect(page.locator('a[href="/register?next=/checkout"]')).toBeVisible({ timeout: 40_000 });
    await assertNoHorizontalOverflow(page, "тизер");
  });
}

test.describe("клавиатура и фокус в тесте (ТЗ аудита §14)", () => {
  test("вариант ответа доступен с клавиатуры (Tab + Enter), фокус переходит на новый вопрос", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/start");
    await page.locator('button[name="pathType"]').first().click();
    await page.waitForURL("**/test");
    const startBtn = page.getByRole("button", { name: /Начать тест|Testni boshlash/ });
    if (await startBtn.count()) await startBtn.click();

    // Кнопки вариантов ответа — единственные интерактивные элементы в группе; добираемся до первой
    // клавиатурой и активируем Enter, как это делал бы человек, не пользующийся мышью.
    const firstOption = page.getByRole("group").getByRole("button").first();
    await firstOption.focus();
    await page.keyboard.press("Enter");

    // После ответа фокус — на заголовке нового вопроса (не остаётся на кнопке прежнего ответа).
    const heading = page.locator("h1").first();
    await expect(heading).toBeFocused({ timeout: 5_000 });
  });

  test("Tab добирается до варианта ответа без ловушек фокуса", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/start");
    await page.locator('button[name="pathType"]').first().click();
    await page.waitForURL("**/test");
    const startBtn = page.getByRole("button", { name: /Начать тест|Testni boshlash/ });
    if (await startBtn.count()) await startBtn.click();

    let reachedOption = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const active = page.locator(":focus");
      const withinGroup = await active.evaluate((el) => !!el.closest('[role="group"]')).catch(() => false);
      if (withinGroup) {
        reachedOption = true;
        break;
      }
    }
    expect(reachedOption, "клавиша Tab должна доводить фокус до варианта ответа").toBe(true);
  });
});

test.describe("увеличение текста до 200% (ТЗ аудита §14)", () => {
  test("главная: основное действие остаётся доступным и кликабельным при zoom 200%", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => {
      (document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom = "2";
    });
    const cta = page.getByRole("link", { name: /Начать бесплатный тест|Bepul testni boshlash/ }).first();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box, "кнопка начала должна иметь видимые размеры при zoom 200%").not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("экран вопроса: варианты ответа остаются доступны и не перекрываются при zoom 200%", async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/start");
    await page.locator('button[name="pathType"]').first().click();
    await page.waitForURL("**/test");
    const startBtn = page.getByRole("button", { name: /Начать тест|Testni boshlash/ });
    if (await startBtn.count()) await startBtn.click();

    await page.evaluate(() => {
      (document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom = "2";
    });
    const options = page.getByRole("group").getByRole("button");
    await expect(options.first()).toBeVisible();
    // Соседние варианты не должны схлопываться в одну точку (перекрытие блоков при увеличении).
    const first = await options.nth(0).boundingBox();
    const second = await options.nth(1).boundingBox();
    expect(first && second, "варианты ответа должны иметь размеры при zoom 200%").toBeTruthy();
    expect(second!.y).toBeGreaterThan(first!.y);
  });
});
