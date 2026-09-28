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

// UX-04, часть 2: на боевом экране узбекский текст должен использовать oʻ/gʻ/ʼ (U+02BB/U+02BC),
// а не простой апостроф ('), как это уже приведено в data/tests/*.json и в словаре uz.ts.
async function assertNoPlainApostropheInWord(page: Page, label: string) {
  const text = await page.locator("body").innerText();
  const match = text.match(/[A-Za-zʻʼ]'[A-Za-zʻʼ]/);
  expect(match, `простой апостроф внутри слова на «${label}»: «${match?.[0]}»`).toBeNull();
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
    if (locale === "uz") await assertNoPlainApostropheInWord(page, "тест (вопрос)");

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

    // Круги шкалы — радиокнопки в группе (этап 2а); добираемся до первого клавиатурой и активируем
    // Enter, как это делал бы человек, не пользующийся мышью.
    const firstOption = page.getByRole("radiogroup").getByRole("radio").first();
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
      const withinGroup = await active.evaluate((el) => el.getAttribute("role") === "radio" && !!el.closest('[role="radiogroup"]')).catch(() => false);
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
    const options = page.getByRole("radiogroup").getByRole("radio");
    await expect(options).toHaveCount(5);
    // Круги шкалы стоят в ряд (этап 2а): соседние не должны перекрываться и схлопываться в одну
    // точку при увеличении. При 200% на 390px шкале остаётся ~160px, круги уменьшаются, но область
    // нажатия — не меньше 24×24 (WCAG 2.5.8); без увеличения — 44×44 (e2e/test-flow.spec.ts).
    const boxes = await options.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    for (const [i, box] of boxes.entries()) {
      expect(box.width, `круг ${i + 1}: ширина области нажатия`).toBeGreaterThanOrEqual(24);
      expect(box.height, `круг ${i + 1}: высота области нажатия`).toBeGreaterThanOrEqual(24);
      if (i > 0) {
        const prev = boxes[i - 1]!;
        const apart = box.x >= prev.x + prev.width - 0.5 || box.y >= prev.y + prev.height - 0.5;
        expect(apart, `круги ${i} и ${i + 1} перекрываются при zoom 200%`).toBe(true);
      }
    }
    // И весь ряд помещается в свою строку — последний круг не вылезает за край шкалы.
    const row = (await page.getByRole("radiogroup").boundingBox())!;
    const last = boxes[boxes.length - 1]!;
    expect(last.x + last.width, "шкала не помещается в ширину при zoom 200%").toBeLessThanOrEqual(row.x + row.width + 1);
  });
});
