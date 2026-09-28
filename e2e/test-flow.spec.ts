import { expect, test, type Locator, type Page } from "@playwright/test";
import bigFive from "../data/tests/ipip_neo_60_short.json";
import perception from "../data/tests/perception_8.json";
import riasec from "../data/tests/riasec_30.json";
import values from "../data/tests/values_12.json";
import { estimateMinutes, fmt, fmtCount } from "../src/i18n/format";
import { ru } from "../src/i18n/dictionaries/ru";
import { uz } from "../src/i18n/dictionaries/uz";

// Этап 2а «Новый стиль» (сентябрь 2026): экраны от выбора пути до ожидания бесплатного результата.
// Реальные клики на собранном сайте (как остальные e2e): /start → «Перед началом» → вопросы теста
// мышью, клавиатурой (стрелки + Enter) и клавишами 1–5 → «Назад» (прежний ответ подсвечен) →
// конец первой части → экран между частями → «Davom etish» → пауза и возврат. UZ и RU, ширина
// 390 / 820 / 1280. Плюс анкета и экран ожидания тизера (с честным статусом, без «фальшивого
// прогресса», UX-20) и его ошибка.
//
// Чтобы не отвечать на 60 вопросов ради границы части, остальные ответы первой части отправляются
// тем же запросом, что шлёт сама страница (POST /api/session/answers), — как /dev/quick-start в
// других e2e, только для одной части.

const DICTS = { ru, uz } as const;
const LOCALES = ["uz", "ru"] as const;
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 800 },
];

type Locale = (typeof LOCALES)[number];

// Подписи шкал — те же, что видит человек (из data/tests/*.json; узбекские апострофы в этих файлах
// обычные ' — на сайте их исправляет код, поэтому здесь приводим к ʻ/ʼ так же).
function uzFix(text: string): string {
  return text.replace(/([oOgG])'/g, "$1ʻ").replace(/(\p{L})'(\p{L})/gu, "$1ʼ$2");
}
function scaleLabels(file: { scoring: { response_scale: { label_ru: string; label_uz: string }[] } }, locale: Locale) {
  return file.scoring.response_scale.map((s) => (locale === "ru" ? s.label_ru : uzFix(s.label_uz)));
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `горизонтальная прокрутка на «${label}»: ${scrollWidth} > ${clientWidth}`).toBeLessThanOrEqual(clientWidth + 1);
}

// Контраст текста элемента с его фоном (ближайший непрозрачный фон вверх по дереву) — WCAG 2.x.
async function contrastOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const fg = parse(getComputedStyle(el).color);
    let node: Element | null = el;
    let bg = [255, 255, 255];
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3]! > 0.99)) {
        bg = c;
        break;
      }
      node = node.parentElement;
    }
    const [a, b] = [lum(fg), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

async function startTest(page: Page) {
  await page.goto("/start");
  await page.locator('button[name="pathType"][value="knows_goal"]').click();
  await page.waitForURL("**/test");
}

for (const locale of LOCALES) {
  const t = DICTS[locale];
  for (const vp of WIDTHS) {
    test(`тест: мышь, клавиатура, «Назад», граница части, пауза [${locale}, ${vp.width}]`, async ({ page, context }) => {
      test.setTimeout(90_000);
      await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3000" }]);
      await page.setViewportSize(vp);
      const desktop = vp.width >= 1024;

      // 1) /start: две карточки выбора пути.
      await page.goto("/start");
      await expect(page.locator('button[name="pathType"]')).toHaveCount(2);
      await assertNoHorizontalOverflow(page, "/start");
      await page.locator('button[name="pathType"][value="knows_goal"]').click();
      await page.waitForURL("**/test");

      // 2) «Перед началом»: 4 части, число вопросов — из данных, три правила.
      await expect(page.getByRole("heading", { level: 1, name: t.test.prep.title })).toBeVisible();
      await expect(page.getByText(fmt(t.test.prep.subtitle, { parts: 4, min: estimateMinutes(110) }))).toBeVisible();
      for (const [i, count] of [60, 30, 12, 8].entries()) {
        await expect(page.getByText(t.test.prep.blockHints[i]!, { exact: true }).filter({ visible: true })).toHaveCount(1);
        await expect(page.getByText(fmtCount(t.test.questionsCount, count), { exact: true }).filter({ visible: true })).toHaveCount(1);
      }
      for (const rule of t.test.prep.rules) await expect(page.getByText(rule, { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page, "перед началом");
      await page.getByRole("button", { name: t.test.prep.start }).click();

      // 3) Экран вопроса: радиогруппа из 5 кругов, имя круга — полная подпись варианта.
      const labels = scaleLabels(bigFive, locale);
      const scale = page.getByRole("radiogroup");
      const radios = scale.getByRole("radio");
      await expect(radios).toHaveCount(5);
      for (const [i, label] of labels.entries()) await expect(radios.nth(i)).toHaveAccessibleName(label);
      await expect(scale.locator("[aria-checked=true]")).toHaveCount(0);
      const pill = page.locator("[data-scale-pill]");
      const counter = (n: number, total = 60) => page.getByText(`${n}/${total}`, { exact: true });
      await expect(counter(1)).toBeVisible();
      await expect(pill).toHaveText(t.test.chooseAnswer);
      await expect(page.getByText(t.test.prompts.big_five, { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page, "вопрос");
      // Область нажатия каждого круга — не меньше 44×44.
      for (let i = 0; i < 5; i++) {
        const box = (await radios.nth(i).boundingBox())!;
        expect(box.width, `круг ${i + 1}`).toBeGreaterThanOrEqual(44);
        expect(box.height, `круг ${i + 1}`).toBeGreaterThanOrEqual(44);
      }
      // Подписи краёв шкалы и плашка выбранного ответа — контраст не ниже 4.5:1.
      const edgeLeft = page.getByText(labels[0]!.split(" / ")[0]!, { exact: true });
      const edgeRight = page.getByText(labels[4]!.split(" / ")[0]!, { exact: true });
      expect(await contrastOf(edgeLeft)).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(edgeRight)).toBeGreaterThanOrEqual(4.5);
      // Подсказка про клавиши 1–5 — только на компьютере.
      if (desktop) await expect(page.getByText(t.test.keyboardHint)).toBeVisible();
      else await expect(page.getByText(t.test.keyboardHint)).toBeHidden();

      // Вопрос 1 — мышью (4-й круг).
      const heading = page.locator("h1[aria-live='polite']");
      await radios.nth(3).click();
      await expect(counter(2)).toBeVisible();
      await expect(heading).toBeFocused();

      // Вопрос 2 — клавиатурой: Tab до шкалы, стрелки двигают фокус, НЕ выбирая, Enter выбирает.
      await page.keyboard.press("Tab");
      await expect(radios.nth(0)).toBeFocused();
      // Фокус виден: у круга в фокусе есть обводка.
      const outline = await radios.nth(0).locator("span").evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, "фокус на круге шкалы должен быть виден").not.toBe("none");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(radios.nth(2)).toBeFocused();
      await expect(scale.locator("[aria-checked=true]")).toHaveCount(0);
      await expect(counter(2)).toBeVisible();
      // Плашка подсказывает, что за вариант в фокусе.
      await expect(pill).toHaveText(labels[2]!);
      await page.keyboard.press("ArrowLeft");
      await expect(radios.nth(1)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(counter(3)).toBeVisible();
      await expect(heading).toBeFocused();

      // Вопросы 3–4 — клавишами 1–5 (проверяем на компьютере, где есть подсказка).
      let lastAnswer = 2; // вопрос 2: второй круг
      let lastQuestion = 2;
      if (desktop) {
        await page.keyboard.press("5");
        await expect(counter(4)).toBeVisible();
        await page.keyboard.press("1");
        await expect(counter(5)).toBeVisible();
        lastAnswer = 1;
        lastQuestion = 4;
      }

      // «Назад»: прежний ответ подсвечен, плашка — его полная подпись.
      await page.getByRole("button", { name: t.test.back, exact: true }).click();
      await expect(counter(lastQuestion)).toBeVisible();
      await expect(radios.nth(lastAnswer - 1)).toHaveAttribute("aria-checked", "true");
      await expect(scale.locator("[aria-checked=true]")).toHaveCount(1);
      await expect(pill).toHaveText(labels[lastAnswer - 1]!);
      // Плашка выбранного ответа — контраст не ниже 4.5:1.
      expect(await contrastOf(pill)).toBeGreaterThanOrEqual(4.5);

      // 4) Граница первой части: остальные ответы части — тем же запросом, что шлёт страница.
      const sessionId = (await context.cookies()).find((c) => c.name === "yw_session")!.value;
      const rest = bigFive.questions.slice(0, -1).map((q) => ({ test: "big_five", questionId: q.id, value: 3 }));
      const res = await page.request.post("/api/session/answers", { data: { sessionId, answers: rest } });
      expect(res.ok()).toBe(true);
      await page.reload();
      await expect(counter(60)).toBeVisible();
      await radios.nth(4).click();

      // Экран между частями: 4 сегмента, «пройдена 1 из 4», заголовок, карточка следующей части.
      await expect(page.getByRole("heading", { level: 1, name: fmt(t.test.interstitial.title, { n: 1 }) })).toBeVisible();
      await expect(page.getByText(fmt(t.test.interstitial.progress, { n: 1, total: 4 }), { exact: true })).toBeVisible();
      await expect(page.getByText(t.test.interstitial.afterBigFive, { exact: true })).toBeVisible();
      await expect(page.getByText(t.test.parts.riasec, { exact: true })).toBeVisible();
      await expect(
        page.getByText(fmt(t.test.interstitial.nextMeta, { questions: fmtCount(t.test.questionsCount, 30), min: estimateMinutes(30) }), { exact: true }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "между частями");

      // Пауза со ссылки под кнопкой и возврат.
      await page.getByRole("button", { name: t.test.interstitial.pauseLink }).click();
      await expect(page.getByText(t.test.pauseTitle, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: t.test.pauseResume }).click();
      await expect(page.getByText(t.test.pauseTitle, { exact: true })).toBeHidden();

      // «Davom etish / Продолжить» → первая часть «Интересы», своя шкала.
      await page.getByRole("button", { name: t.test.interstitial.continue, exact: true }).click();
      await expect(counter(1, 30)).toBeVisible();
      await expect(page.getByText(t.test.prompts.riasec, { exact: true })).toBeVisible();
      const riasecLabels = scaleLabels(riasec, locale);
      for (const [i, label] of riasecLabels.entries()) await expect(radios.nth(i)).toHaveAccessibleName(label);

      // Пауза на экране вопроса: пока она открыта, клавиши 1–5 не отвечают.
      await page.getByRole("button", { name: t.test.pause, exact: true }).click();
      await expect(page.getByText(t.test.pauseTitle, { exact: true })).toBeVisible();
      await page.keyboard.press("2");
      await page.waitForTimeout(400);
      await expect(counter(1, 30)).toBeVisible();
      await page.getByRole("button", { name: t.test.pauseResume }).click();
      await expect(page.getByText(t.test.pauseTitle, { exact: true })).toBeHidden();

      // Возврат после ухода: перезагрузка — тот же вопрос (сначала снова экран между частями).
      await expect(page.getByText(t.test.saved, { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: t.test.interstitial.continue, exact: true }).click();
      await expect(counter(1, 30)).toBeVisible();
    });
  }
}

test.describe("анкета в новом стиле", () => {
  for (const vp of [WIDTHS[0]!, WIDTHS[2]!]) {
    test(`анкета: каркас как у вопроса, варианты-«таблетки», число [uz, ${vp.width}]`, async ({ page, context }) => {
      test.setTimeout(60_000);
      await context.addCookies([{ name: "locale", value: "uz", url: "http://localhost:3000" }]);
      await page.setViewportSize(vp);
      await startTest(page);
      // Все 110 ответов — тем же запросом, что шлёт страница теста, затем к анкете.
      const sessionId = (await context.cookies()).find((c) => c.name === "yw_session")!.value;
      const files = { big_five: bigFive, riasec, values, perception };
      const answers = Object.entries(files).flatMap(([test, f]) => f.questions.map((q) => ({ test, questionId: q.id, value: 4 })));
      expect((await page.request.post("/api/session/answers", { data: { sessionId, answers } })).ok()).toBe(true);
      await page.goto("/survey");

      // Возраст — числовое поле с доступным именем (заголовок вопроса).
      const age = page.getByRole("spinbutton");
      await expect(age).toBeVisible();
      await assertNoHorizontalOverflow(page, "анкета: число");
      if (vp.width >= 1024) await expect(page.getByText(uz.flow.stages.test, { exact: true }).filter({ visible: true })).toHaveCount(1);
      await age.fill("20");
      await page.getByRole("button", { name: uz.survey.next }).click();

      // Пол — варианты-карточки; выбор ведёт к следующему вопросу, «Orqaga» показывает прежний выбор.
      const options = page.locator("main button[aria-pressed]");
      await expect(options.first()).toBeVisible();
      await assertNoHorizontalOverflow(page, "анкета: варианты");
      await options.first().click();
      await expect(page.getByText("3/3", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: uz.survey.back }).click();
      await expect(options.first()).toHaveAttribute("aria-pressed", "true");
    });
  }
});

test.describe("ожидание бесплатного результата", () => {
  // Генерацию «замораживаем» подменой ответа /api/teaser — чтобы увидеть экран ожидания и ошибку.
  for (const vp of [WIDTHS[0]!, WIDTHS[2]!]) {
    test(`экран ожидания: компас, фразы без «шагов», секундомер; ошибка — «Qayta urinish» [uz, ${vp.width}]`, async ({ page, context }) => {
      test.setTimeout(60_000);
      await context.addCookies([{ name: "locale", value: "uz", url: "http://localhost:3000" }]);
      await page.setViewportSize(vp);
      let mode: "generating" | "failed" = "generating";
      await page.route("**/api/teaser", (route) => route.fulfill({ json: { status: mode } }));
      await page.goto("/dev/quick-start?path=knows_goal");
      await page.waitForURL("**/teaser");

      const g = uz.teaser.generating;
      await expect(page.getByRole("heading", { level: 1, name: g.title })).toBeVisible();
      await expect(page.locator("svg .yw-compass-rose")).toHaveCount(1);
      // Никакого «прогресса»: ни progressbar, ни списка шагов с галочками, ни «шаг N из M».
      await expect(page.getByRole("progressbar")).toHaveCount(0);
      await expect(page.locator("main").getByRole("listitem")).toHaveCount(0);
      const firstStep = page.getByText(g.steps[0]!, { exact: true });
      await expect(firstStep).toBeVisible();
      await expect(page.getByText(g.steps[1]!, { exact: true })).toBeVisible({ timeout: 6_000 });
      await expect(page.getByText(/^0:0[3-9]$/)).toBeVisible();
      await expect(page.getByText(g.wait, { exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page, "ожидание тизера");

      mode = "failed";
      await expect(page.getByRole("heading", { level: 1, name: uz.teaser.failedTitle })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: uz.teaser.retry })).toBeVisible();
      await assertNoHorizontalOverflow(page, "ошибка тизера");
      mode = "generating";
      await page.getByRole("button", { name: uz.teaser.retry }).click();
      await expect(page.getByRole("heading", { level: 1, name: g.title })).toBeVisible();
    });
  }
});
