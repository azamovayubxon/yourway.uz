import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ru } from "../src/i18n/dictionaries/ru";
import { uz } from "../src/i18n/dictionaries/uz";

// Этап 2б: страница бесплатного результата в новом стиле, «Поделиться» и «Сохранить картинку».
// Реальные клики на собранном сайте (тестовый режим ИИ), UZ и RU, 390 и 1280 px:
//  • тизер отрисован по новой схеме (карточка типа, кнопки, «карта интересов» без чисел — UX-16);
//  • «Поделиться» → ссылка /t/[code]: там тип и три сильные стороны, и ЯВНО нет портрета,
//    направлений, бесплатного шага, загадки и 16-типа; noindex; превью opengraph-image — PNG;
//  • «Сохранить картинку»: у владельца PNG, у чужой сессии и без сессии — 404;
//  • после удаления аккаунта /t/[code] и его картинка — 404 (каскадное удаление);
//  • в /admin/analytics растут «Поделились» и «Сохранили картинку».
// Суперадмин — тот же e2ehome, что в e2e/home.spec.ts (SUPERADMIN_LOGINS в .github/workflows/e2e.yml):
// отдельный аккаунт не заводим, потому что регистрация ограничена 20 аккаунтами с одного IP в час
// (AUTH_REGISTER_PER_IP_PER_HOUR), а весь прогон e2e идёт с одного адреса.

const BASE = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-9";
const ADMIN_LOGIN = "e2ehome";
const DICT = { uz, ru } as const;

function uniqueLogin(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}`;
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

async function newContext(browser: Browser, locale: "uz" | "ru", width: number): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 }, acceptDownloads: true });
  await context.addCookies([{ name: "locale", value: locale, url: BASE }]);
  return context;
}

// Тесты — служебной ссылкой (110 вопросов), дальше — готовый тизер в тестовом режиме ИИ.
async function openTeaser(page: Page) {
  await page.goto("/dev/quick-start?path=no_goal");
  await page.waitForURL("**/teaser", { timeout: 20_000 });
  await expect(page.locator('a[href="/register?next=/checkout"]')).toBeVisible({ timeout: 40_000 });
}

async function signInAdmin(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="login"]').fill(ADMIN_LOGIN);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname.startsWith("/account")) return;
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

async function analyticsTotal(admin: Page, label: string): Promise<number> {
  await admin.goto("/admin/analytics");
  const row = admin.locator("tr", { has: admin.locator("td", { hasText: new RegExp(`^${label}$`) }) });
  await expect(row).toHaveCount(1);
  return Number(await row.locator("td").nth(3).innerText());
}

for (const locale of ["uz", "ru"] as const) {
  for (const width of [390, 1280]) {
    test(`тизер в новом стиле и «Поделиться» [${locale}, ${width}px]`, async ({ browser }) => {
      test.setTimeout(120_000);
      const t = DICT[locale].teaser;
      const context = await newContext(browser, locale, width);
      const page = await context.newPage();
      await openTeaser(page);
      await assertNoHorizontalOverflow(page, "тизер");

      // Карточка типа: название — h1, три сильные стороны таблетками.
      const typeCard = page.locator('section[aria-labelledby="type-title"]');
      await expect(typeCard).toBeVisible();
      await expect(typeCard.getByText(t.yourType)).toBeVisible();
      const typeLabel = (await page.locator("h1#type-title").innerText()).trim();
      await expect(typeCard.locator("li")).toHaveCount(3);
      const strengths = (await typeCard.locator("li").allInnerTexts()).map((s) => s.trim());

      // «Карта интересов»: SVG с описанием для читалок, шесть подписей, никаких чисел и процентов.
      const map = page.locator("section", { has: page.locator("h2", { hasText: t.interestMap.title }) });
      await expect(map).toBeVisible();
      const svg = map.locator('svg[role="img"]');
      await expect(svg).toHaveAttribute("aria-label", new RegExp(t.interestMap.strongest.split("{a}")[0]));
      await expect(svg.locator("text")).toHaveCount(6);
      expect(await map.innerText()).not.toMatch(/\d|%/);
      // Подписи вершин не обрезаются: каждая целиком внутри SVG.
      const clipped = await svg.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return [...el.querySelectorAll("text")].some((node) => {
          const r = node.getBoundingClientRect();
          return r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5;
        });
      });
      expect(clipped, "подпись вершины выходит за пределы карты").toBe(false);

      // Тексты, которых НЕ должно быть на открытой странице.
      const portraitCard = page.locator("section", { has: page.getByText(t.sixteenTypeNote) });
      const portrait = (await portraitCard.locator("p").first().innerText()).trim();
      const directions = page.locator("h2", { hasText: t.directionsTitle }).locator("xpath=..");
      const directionTitles = (await directions.locator("ol > li h3").allInnerTexts()).map((s) => s.trim());
      expect(directionTitles).toHaveLength(3);
      const freeStep = (
        await page.locator("h2", { hasText: t.freeStepTitle }).locator("xpath=..").locator("p").last().innerText()
      ).trim();
      const sixteen = (await page.getByText(t.sixteenTypeNote).locator("xpath=..").locator("span").first().innerText()).trim();

      // «Поделиться»: в headless Chromium нет navigator.share — открывается своё меню.
      await page.getByRole("button", { name: t.share }).click();
      await expect(page.getByText(t.shareNote)).toBeVisible();
      await expect(page.getByRole("link", { name: t.shareTelegram, exact: true })).toHaveAttribute("href", /^https:\/\/t\.me\/share\/url\?url=/);
      const shareUrl = await page.locator("input[readonly]").inputValue();
      expect(shareUrl).toMatch(/\/t\/[23456789abcdefghjkmnpqrstuvwxyz]{12}$/);
      await page.getByRole("button", { name: t.copyLink }).click();
      await expect(page.getByText(t.linkCopied)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByText(t.shareNote)).toHaveCount(0);
      await expect(page.getByRole("button", { name: t.share })).toBeFocused();

      // Повторное нажатие — та же ссылка (одна карточка на тизер).
      await page.getByRole("button", { name: t.share }).click();
      await expect(page.locator("input[readonly]")).toHaveValue(shareUrl);
      await page.keyboard.press("Escape");

      // Открытая страница: тип и три сильные стороны — да; всё остальное — нет.
      const guest = await browser.newContext({ viewport: { width, height: 900 } });
      const pub = await guest.newPage();
      const res = await pub.goto(shareUrl);
      expect(res?.status()).toBe(200);
      await assertNoHorizontalOverflow(pub, "открытая страница");
      await expect(pub.locator("h1")).toHaveText(typeLabel);
      for (const s of strengths) await expect(pub.getByText(s, { exact: true })).toBeVisible();
      await expect(pub.getByText(DICT[locale].sharePage.ctaTitle)).toBeVisible();
      await expect(pub.getByRole("link", { name: DICT[locale].sharePage.cta })).toHaveAttribute("href", "/start");
      const html = await pub.content();
      const body = await pub.locator("body").innerText();
      for (const hidden of [portrait.slice(0, 40), ...directionTitles, freeStep.slice(0, 40), sixteen]) {
        expect(hidden.length).toBeGreaterThan(3);
        expect(body, `на открытой странице виден лишний текст: «${hidden}»`).not.toContain(hidden);
        expect(html, `в HTML открытой страницы есть лишний текст: «${hidden}»`).not.toContain(hidden);
      }
      expect(await pub.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
      const ogUrl = await pub.locator('meta[property="og:image"]').getAttribute("content");
      expect(ogUrl).toBeTruthy();
      const og = await guest.request.get(ogUrl!);
      expect(og.status()).toBe(200);
      expect(og.headers()["content-type"]).toBe("image/png");

      // «Сохранить картинку»: владелец скачивает PNG yourway-tip.png…
      const save = page.getByRole("link", { name: t.saveImage });
      const imageHref = (await save.getAttribute("href"))!;
      const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);
      expect(download.suggestedFilename()).toBe("yourway-tip.png");
      const own = await context.request.get(imageHref);
      expect(own.status()).toBe(200);
      expect(own.headers()["content-type"]).toBe("image/png");
      // …без сессии и из чужой сессии — 404, чужой тизер нельзя и «поделиться».
      expect((await guest.request.get(`${BASE}${imageHref}`)).status()).toBe(404);
      const other = await newContext(browser, locale, width);
      const otherPage = await other.newPage();
      await openTeaser(otherPage);
      expect((await other.request.get(`${BASE}${imageHref}`)).status()).toBe(404);
      const teaserId = new URL(imageHref, BASE).searchParams.get("teaser");
      const foreignShare = await other.request.post(`${BASE}/api/share`, { data: { teaserId } });
      expect(foreignShare.status()).toBe(404);
      await other.close();
      await guest.close();
      await context.close();
    });
  }
}

test("после удаления аккаунта открытая страница и её картинка — 404; счётчики в /admin/analytics", async ({ browser }) => {
  test.setTimeout(120_000);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signInAdmin(admin);
  const sharedBefore = await analyticsTotal(admin, "Поделились");
  const savedBefore = await analyticsTotal(admin, "Сохранили картинку");

  const context = await newContext(browser, "ru", 390);
  const page = await context.newPage();
  await openTeaser(page);
  await page.getByRole("button", { name: ru.teaser.share }).click();
  const shareUrl = await page.locator("input[readonly]").inputValue();
  await page.keyboard.press("Escape");
  const imageHref = (await page.getByRole("link", { name: ru.teaser.saveImage }).getAttribute("href"))!;
  expect((await context.request.get(imageHref)).status()).toBe(200);

  expect(await analyticsTotal(admin, "Поделились")).toBe(sharedBefore + 1);
  expect(await analyticsTotal(admin, "Сохранили картинку")).toBe(savedBefore + 1);

  const guest = await browser.newContext();
  const pub = await guest.newPage();
  await pub.goto(shareUrl);
  const ogUrl = (await pub.locator('meta[property="og:image"]').getAttribute("content"))!;

  // Регистрация (сессия привязывается к аккаунту) → удаление аккаунта.
  await page.locator('a[href="/register?next=/checkout"]').click();
  await page.waitForURL("**/register**");
  await page.locator('input[name="login"]').fill(uniqueLogin("share"));
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  const codeCheckbox = page.locator('input[type="checkbox"]');
  await expect(codeCheckbox).toBeVisible();
  await codeCheckbox.check();
  await page.goto("/account/delete");
  await page.locator('input[type="checkbox"]').check();
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/account/delete"), { timeout: 15_000 });

  expect((await guest.request.get(shareUrl)).status()).toBe(404);
  expect((await guest.request.get(ogUrl)).status()).toBe(404);
  await guest.close();
  await context.close();
  await adminContext.close();
});
