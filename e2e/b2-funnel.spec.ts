import { expect, test, type Page } from "@playwright/test";
import { ru } from "../src/i18n/dictionaries/ru";
import { uz } from "../src/i18n/dictionaries/uz";

// Этап B2 (аудит §7–§9, §12, UX-13/14/17/18/19): реальные клики на собранном сайте (`next build`
// + `.next/standalone`, как в Dockerfile и в e2e/csp-hydration.spec.ts), не SSR и не dev-сервер.
// Путь: тизер → выбор пакета → смена языка отчёта → «без цели» + «Маршрут» → выбор цели (UX-18) →
// тестовая оплата → генерация → отчёт → PDF → кабинет. Проверяется на русском и узбекском и на
// четырёх ширинах экрана (360/390/768/1440 px) — не переиспользуем один браузерный контекст между
// комбинациями, чтобы аккаунты и куки не пересекались.
//
// /dev/quick-start используется только для быстрого прохождения самих тестов (110 вопросов) —
// сам путь тизер→…→кабинет проходится настоящими кликами без сокращений (как и в
// e2e/csp-hydration.spec.ts). Работает только вне боевого сайта (VERCEL_ENV=preview в CI/локально).

const PASSWORD = "correct-horse-battery-9";

function uniqueLogin(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}`;
}

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
];

const LOCALES = ["ru", "uz"] as const;

// Страница не должна вызывать горизонтальный скролл (ТЗ аудита §14): ширина документа не больше
// ширины окна с небольшим запасом на округление суб-пикселей.
async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `горизонтальное переполнение на «${label}»: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth + 1,
  );
}

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    test(`тизер → checkout → оплата → отчёт → PDF → кабинет [${locale}, ${viewport.name}]`, async ({ page, context }) => {
      test.setTimeout(90_000);
      await context.addCookies([
        { name: "locale", value: locale, url: "http://localhost:3000" },
      ]);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // 1) Тизер — сессия «без цели» (для UX-18 ниже), сами тесты пройдены служебной ссылкой.
      await page.goto("/dev/quick-start?path=no_goal");
      await page.waitForURL("**/teaser", { timeout: 20_000 });
      const unlock = page.locator('a[href="/register?next=/checkout"]');
      await expect(unlock).toBeVisible({ timeout: 40_000 });
      await assertNoHorizontalOverflow(page, "тизер");

      // Решение владельца (сентябрь 2026, этап B2а): ровно 3 сильные стороны и 3 направления,
      // список закрытых разделов убран — вместо него описание пакета.
      const strengthsSection = page.locator("h2", { hasText: /Ваши сильные стороны|Kuchli tomonlaringiz/ }).locator("xpath=..");
      await expect(strengthsSection.locator("li")).toHaveCount(3);
      const directionsSection = page.locator("h2", { hasText: /Вам подходит|Sizga mos yoʻnalishlar/ }).locator("xpath=..");
      await expect(directionsSection.locator("ol > li")).toHaveCount(3);
      await expect(page.getByText(/Qulf ostidagi boʻlimlar|закрытых раздел/i)).toHaveCount(0);
      await expect(page.getByText(/Bir martalik toʻlov|Разовая оплата/)).toBeVisible();

      // 2) Регистрация (появляется только перед оплатой) → checkout.
      await unlock.click();
      await page.waitForURL("**/register**");
      const login = uniqueLogin(`b2${locale}${viewport.width}`);
      await page.locator('input[name="login"]').fill(login);
      await page.locator('input[name="password"]').fill(PASSWORD);
      await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
      const codeCheckbox = page.locator('input[type="checkbox"]');
      await expect(codeCheckbox).toBeVisible();
      await codeCheckbox.check();
      await page.locator('a[href="/checkout"]').click();
      await page.waitForURL("**/checkout");
      await assertNoHorizontalOverflow(page, "checkout");

      // 3) Выбор пакета: «без цели» рекомендует «Навигатор» — переключаемся на «Маршрут»,
      // это должно открыть выбор цели (UX-18).
      await page.locator('input[name="level-choice"][value="route"]').check();
      const goalPicker = page.getByRole("radiogroup", { name: /Выберите цель|Marshrut uchun maqsad/ });
      await expect(goalPicker).toBeVisible();
      const payButton = page.locator('form:has(input[name="level"]) button[type="submit"]');
      await expect(payButton).toBeDisabled();
      // Выбираем цель — первое направление из бесплатного результата (не «своя формулировка»).
      await goalPicker.locator("label").first().click();
      await expect(payButton).toBeEnabled();

      // 4) Смена языка отчёта (UX-06) — переключаем на язык, отличный от языка интерфейса.
      // Подписи кнопок — название языка НА ТЕКУЩЕМ языке интерфейса (Ruscha при uz-интерфейсе,
      // Русский при ru-интерфейсе), поэтому берём их из словаря текущего локейла, а не хардкодим.
      const otherLocale = locale === "ru" ? "uz" : "ru";
      const dict = locale === "ru" ? ru : uz;
      const otherLocaleLabel = dict.checkout.reportLanguageNames[otherLocale];
      await page.getByRole("button", { name: otherLocaleLabel, exact: true }).click();
      await expect(page.getByRole("button", { name: otherLocaleLabel, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 5) Тестовая оплата.
      await payButton.click();
      await page.waitForURL("**/checkout/test/**", { timeout: 15_000 });
      await page.locator('button[name="outcome"][value="pay"]').click();
      await page.waitForURL("**/report/**", { timeout: 15_000 });

      // 6) Генерация в фоне (уровень «route» — 3 части) → первый экран отчёта (ТЗ аудита §9).
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
      await assertNoHorizontalOverflow(page, "отчёт");
      await expect(page.getByText(/Короче говоря|Qisqacha aytganda/)).toBeVisible();
      const pdfLink = page.locator('a[href*="/pdf"]').first();
      await expect(pdfLink).toBeVisible();
      // Отчёт написан на otherLocale (только что выбранном на checkout) независимо от того,
      // что язык интерфейса остался прежним — оболочка и содержимое не должны путаться (UX-06).
      await expect(page.locator("h1").first()).toHaveAttribute("lang", otherLocale);

      // 7) PDF — настоящий клик и скачивание, не просто запрос по URL.
      const [download] = await Promise.all([page.waitForEvent("download"), pdfLink.click()]);
      const downloadedPath = await download.path();
      expect(downloadedPath, "PDF не скачался").toBeTruthy();

      // 8) Кабинет: последний результат наверх, отчёт — с языком и статусом «готов».
      await page.goto("/account");
      await assertNoHorizontalOverflow(page, "кабинет");
      await expect(page.getByText(/Последний результат|Oxirgi natija/)).toBeVisible();
      await expect(page.getByText(/готов|tayyor/)).toBeVisible();
    });
  }
}
