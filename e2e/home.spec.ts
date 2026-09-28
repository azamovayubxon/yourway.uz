import { expect, test, type Browser, type Page } from "@playwright/test";

// Новая главная (этап «Новый стиль, часть 1», сентябрь 2026): реальные клики на собранном сайте,
// UZ и RU, ширина 390 и 1440 — первый экран, переход «Начать тест» → /start, карточка «Скоро» →
// окно → закрытие Esc (фокус возвращается на карточку), счётчик интереса в /admin/analytics,
// фокус-кольцо, отсутствие горизонтальной прокрутки на 375 px и то, что узбекские oʻ gʻ (U+02BB)
// и ʼ (U+02BC) рисуются фирменными шрифтами (Commissioner, Onest), а не запасным системным.
//
// Требует SUPERADMIN_LOGINS со значением e2ehome (см. .github/workflows/e2e.yml) — отдельный
// суперадмин для чтения таблицы «Интерес к направлениям».

const ADMIN_LOGIN = "e2ehome";
const PASSWORD = "correct-horse-battery-9";
const BASE = "http://localhost:3000";

const TEXT = {
  uz: { h1: "Siz oʻylagandan koʻproq yoʻlingiz bor.", start: "Bepul testni boshlash", soonTitle: "Oliygoh tanlash", close: "Yopish" },
  ru: { h1: "У вас больше путей, чем вы думаете.", start: "Начать бесплатный тест", soonTitle: "Выбор вуза", close: "Закрыть" },
} as const;

async function openHome(browser: Browser, locale: "uz" | "ru", width: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 } });
  await context.addCookies([{ name: "locale", value: locale, url: BASE }]);
  const page = await context.newPage();
  await page.goto("/");
  return page;
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `горизонтальная прокрутка на «${label}»: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth + 1,
  );
}

async function signInAdmin(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(ADMIN_LOGIN);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname.startsWith("/account")) return;
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

// Число нажатий «за всё время» по направлению из таблицы «Интерес к направлениям».
async function soonTotal(admin: Page, label: string): Promise<number> {
  await admin.goto("/admin/analytics");
  const row = admin.locator("tr", { has: admin.locator("td", { hasText: new RegExp(`^${label}$`) }) });
  await expect(row).toHaveCount(1);
  return Number(await row.locator("td").last().innerText());
}

for (const locale of ["uz", "ru"] as const) {
  for (const width of [390, 1440]) {
    test(`главная [${locale}, ${width}px]: первый экран, «Начать тест» → /start, «Скоро» → окно → Esc`, async ({
      browser,
    }) => {
      const page = await openHome(browser, locale, width);
      const t = TEXT[locale];

      await expect(page.locator("h1")).toHaveText(t.h1);
      for (const id of ["mission", "directions", "how", "sample", "pricing", "faq"]) {
        await expect(page.locator(`#${id}`), `блок #${id}`).toBeAttached();
      }
      await assertNoHorizontalOverflow(page, "главная");

      // Карточка «Скоро» → окно с названием направления → Esc → окно закрыто, фокус снова на карточке.
      const card = page.locator('button[data-soon="university"]');
      await card.scrollIntoViewIfNeeded();
      const soonRequest = page.waitForResponse((r) => r.url().endsWith("/api/soon"));
      await card.click();
      const dialog = page.getByRole("dialog", { name: t.soonTitle });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: t.close })).toBeVisible();
      expect((await soonRequest).status()).toBe(204);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(card).toBeFocused();

      // Кнопка закрытия тоже работает.
      await card.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: t.close }).click();
      await expect(dialog).toBeHidden();

      // Основная кнопка первого экрана ведёт на экран-развилку.
      await page.getByRole("link", { name: t.start }).first().click();
      await page.waitForURL("**/start");
      await expect(page.locator('button[name="pathType"]').first()).toBeVisible();
      await page.context().close();
    });
  }
}

test("счётчик интереса: нажатие на карточку «Скоро» видно в /admin/analytics", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signInAdmin(admin);
  const before = await soonTotal(admin, "Учёба за рубежом");

  // Новый посетитель: одно нажатие засчитывается, повторное в те же сутки — нет (защита от накрутки).
  const visitor = await openHome(browser, "uz", 390);
  const card = visitor.locator('button[data-soon="abroad"]');
  for (let i = 0; i < 2; i++) {
    const response = visitor.waitForResponse((r) => r.url().endsWith("/api/soon"));
    await card.click();
    expect((await response).status()).toBe(204);
    await visitor.keyboard.press("Escape");
  }

  expect(await soonTotal(admin, "Учёба за рубежом")).toBe(before + 1);
  await visitor.context().close();
  await adminContext.close();
});

test("эндпоинт /api/soon принимает только известные направления", async ({ request }) => {
  expect((await request.post("/api/soon", { data: { id: "career" } })).status()).toBe(400);
  expect((await request.post("/api/soon", { data: "не json" })).status()).toBe(400);
});

test("375 px без горизонтальной прокрутки [uz, ru]", async ({ browser }) => {
  for (const locale of ["uz", "ru"] as const) {
    const page = await openHome(browser, locale, 375);
    await assertNoHorizontalOverflow(page, `главная ${locale} 375`);
    await page.context().close();
  }
});

test("фокус-кольцо видно на карточке «Скоро» и кнопках при работе с клавиатуры", async ({ browser }) => {
  const page = await openHome(browser, "uz", 1440);
  const card = page.locator('button[data-soon="university"]');
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await card.evaluate((el) => el === document.activeElement);
  }
  expect(reached, "Tab должен доводить фокус до карточки «Скоро»").toBe(true);
  // Кольцо фокуса — box-shadow от ring-4 (класс focus-ring).
  expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");

  // Enter открывает окно, фокус внутри окна; кнопки в окне тоже с видимым кольцом.
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  const focusedShadow = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el && el.closest("dialog") ? getComputedStyle(el).boxShadow : "outside-dialog";
  });
  expect(focusedShadow).not.toBe("none");
  expect(focusedShadow).not.toBe("outside-dialog");
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  await page.context().close();
});

// Узбекские знаки oʻ gʻ (U+02BB) и ʼ (U+02BC) должны рисоваться фирменными шрифтами. В Geologica и
// Golos Text этих знаков нет — браузер молча подставил бы системный шрифт. Проверяем двумя способами:
// 1) у загруженного файла шрифта (FontFace, статус loaded) диапазон unicode-range покрывает U+02BB–02BC;
// 2) ширина строки из этих знаков шрифтом «X, monospace» отличается от ширины чистым monospace —
//    то есть глиф взят из X, а не из запасного (контроль: для знака, которого в шрифте нет, ширины равны).
test("знаки ʻ и ʼ рисуются шрифтами Commissioner (заголовок) и Onest (текст)", async ({ browser }) => {
  const page = await openHome(browser, "uz", 1440);
  await page.evaluate(() => document.fonts.ready);

  for (const [selector, expected] of [
    ["h1", "Commissioner"],
    ["#mission h2 ~ div p", "Onest"],
  ] as const) {
    const result = await page.locator(selector).first().evaluate(async (el) => {
      const style = getComputedStyle(el);
      const family = style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
      const weight = style.fontWeight;
      const sample = el.textContent ?? "";
      await document.fonts.load(`${weight} 40px "${family}"`, "ʻʼ");
      const covers = (range: string) =>
        range.split(",").some((part) => {
          const [from, to = from] = part.trim().replace(/^U\+/i, "").split("-");
          const a = parseInt(from, 16);
          const b = parseInt(to, 16);
          return a <= 0x02bb && 0x02bc <= b;
        });
      const faces = [...document.fonts].filter(
        (f) => f.family.replace(/^["']|["']$/g, "") === family && f.status === "loaded" && covers(f.unicodeRange),
      );
      const ctx = document.createElement("canvas").getContext("2d")!;
      const width = (font: string, text: string) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const own = (text: string) => width(`${weight} 40px "${family}", monospace`, text);
      const mono = (text: string) => width(`${weight} 40px monospace`, text);
      return {
        family,
        hasModifierLetters: /ʻ|ʼ/.test(sample),
        loadedFacesWithGlyphs: faces.length,
        turnedCommaDiffers: own("ʻʻʻʻʻʻ") !== mono("ʻʻʻʻʻʻ"),
        apostropheDiffers: own("ʼʼʼʼʼʼ") !== mono("ʼʼʼʼʼʼ"),
        // Контроль метода: иероглифа в шрифте нет — ширина та же, что у запасного.
        controlSame: own("中中中") === mono("中中中"),
      };
    });
    expect(result.family, selector).toBe(expected);
    expect(result.hasModifierLetters, `${selector}: в тексте есть ʻ или ʼ`).toBe(true);
    expect(result.loadedFacesWithGlyphs, `${selector}: файл ${expected} с U+02BB–02BC загружен`).toBeGreaterThan(0);
    expect(result.turnedCommaDiffers, `${selector}: ʻ рисуется шрифтом ${expected}`).toBe(true);
    expect(result.apostropheDiffers, `${selector}: ʼ рисуется шрифтом ${expected}`).toBe(true);
    expect(result.controlSame, "контроль метода сравнения ширины").toBe(true);
  }
  await page.context().close();
});
