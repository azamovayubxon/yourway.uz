import { expect, test, type Page } from "@playwright/test";

// Этап C2 (ТЗ аудита §13, §15 этап C пункты 3–4, §16): устойчивость и приёмка. Реальные клики на
// собранном сайте (как e2e/csp-hydration.spec.ts и e2e/b2-funnel.spec.ts), с имитацией сбоя ИИ
// (/dev/ai-fail — только вне боевого сайта) и обрыва сети (context.setOffline). Проверяется:
//   1) обновление страницы во время генерации не запускает вторую генерацию, а показывает ту же
//      задачу; сбой ИИ → «Сгенерировать заново» без повторной оплаты доводит до готового отчёта;
//   2) повторное открытие уже оплаченной тестовой оплаты не предлагает платить снова и не создаёт
//      второй отчёт (идемпотентность, пригодится для вебхуков этапа 9);
//   3) обрыв сети во время теста показывает честный статус сохранения и восстанавливается без
//      потери ответов;
//   4) чужой/несуществующий отчёт — понятное объяснение вместо голой 404, без утечки чужих данных.

const PASSWORD = "correct-horse-battery-9";

function uniqueLogin(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 100000)}`;
}

// Путь «цель известна» — рекомендованный уровень «Маршрут» уже выбран по умолчанию на checkout,
// цель не нужно выбирать отдельно (UX-18 касается только «без цели» + «Маршрут», см. b2-funnel).
async function quickStartToTeaser(page: Page) {
  await page.goto("/dev/quick-start?path=knows_goal");
  await page.waitForURL("**/teaser", { timeout: 20_000 });
}

async function registerToCheckout(page: Page, login: string) {
  await page.locator('a[href="/register?next=/checkout"]').click();
  await page.waitForURL("**/register**");
  await page.locator('input[name="login"]').fill(login);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').click();
  const codeCheckbox = page.locator('input[type="checkbox"]');
  await expect(codeCheckbox).toBeVisible();
  await codeCheckbox.check();
  await page.locator('a[href="/checkout"]').click();
  await page.waitForURL("**/checkout");
}

// Уровень «Маршрут» уже выбран по умолчанию (рекомендован для «знаю цель») — просто отправляем.
async function payWithTestProvider(page: Page): Promise<{ paymentUrl: string; reportId: string }> {
  await page.locator('form:has(input[name="level"]) button[type="submit"]').click();
  await page.waitForURL("**/checkout/test/**", { timeout: 15_000 });
  const paymentUrl = page.url();
  await page.locator('button[name="outcome"][value="pay"]').click();
  await page.waitForURL("**/report/**", { timeout: 15_000 });
  const reportId = page.url().split("/report/")[1]!.split(/[?#]/)[0]!;
  return { paymentUrl, reportId };
}

async function setAiFail(page: Page, on: boolean) {
  await page.goto("/dev/ai-fail");
  const isOn = (await page.getByText(/имитация сбоя ВКЛЮЧЕНА|nosozlik sinovi YOQILGAN/i).count()) > 0;
  if (isOn !== on) await page.locator('form:has(input[name="on"]) button').click();
}

test.describe("устойчивость генерации и оплаты (этап C2)", () => {
  test("обновление страницы во время генерации отчёта не запускает вторую генерацию", async ({ page }) => {
    test.setTimeout(90_000);
    await quickStartToTeaser(page);
    await registerToCheckout(page, uniqueLogin("resil-reload"));
    const { reportId } = await payWithTestProvider(page);

    // Ещё генерируется (или уже готово — не важно): перезагрузка не должна привести ни к экрану
    // оплаты, ни к другому reportId.
    await page.reload();
    expect(page.url()).toContain(`/report/${reportId}`);
    await expect(page.getByRole("button", { name: /Оплатить|Toʻlash/ })).toHaveCount(0);

    // Дожидаемся готовности (статус со спиннером исчезает) и проверяем, что в кабинете ровно один
    // отчёт — обновление не создало дубликат.
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
    await page.goto("/account");
    await expect(page.locator('a[href^="/report/"]')).toHaveCount(1);
  });

  test("сбой ИИ на генерации отчёта: «Сгенерировать заново» без повторной оплаты доводит до готового отчёта", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await setAiFail(page, true);
    await quickStartToTeaser(page);
    await registerToCheckout(page, uniqueLogin("resil-fail"));
    const { reportId } = await payWithTestProvider(page);

    // Оплата прошла (мы уже на /report/<id>, не на странице оплаты) — сбой ИИ не должен предложить
    // заплатить снова, только объяснить сбой и предложить повтор.
    await expect(page.getByText(/Не получилось дописать отчёт|Hisobotni yozib boʻlmadi/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Оплата сохранена|Toʻlovingiz saqlangan/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Оплатить|Toʻlash/ })).toHaveCount(0);

    await setAiFail(page, false);
    await page.goto(`/report/${reportId}`);
    await page.getByRole("button", { name: /Сгенерировать заново|Qaytadan yozish/ }).click();
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByText(/Короче говоря|Qisqacha aytganda/)).toBeVisible();
  });

  test("повторное открытие уже оплаченной тестовой оплаты не предлагает платить снова", async ({ page }) => {
    test.setTimeout(90_000);
    await quickStartToTeaser(page);
    await registerToCheckout(page, uniqueLogin("resil-pay"));
    const { paymentUrl, reportId } = await payWithTestProvider(page);

    // Второй заход на ту же страницу оплаты (например, повторный клик по старой ссылке, кнопка
    // «Назад» в браузере) — не форма «Оплатить», а прямой переход к уже созданному отчёту.
    await page.goto(paymentUrl);
    await page.waitForURL(`**/report/${reportId}`, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Оплатить|Toʻlash/ })).toHaveCount(0);

    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
    await page.goto("/account");
    await expect(page.locator('a[href^="/report/"]')).toHaveCount(1);
  });

  test("закрытый доступ: чужой отчёт — понятное объяснение, не 404; без входа — на страницу входа", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await quickStartToTeaser(ownerPage);
    await registerToCheckout(ownerPage, uniqueLogin("resil-owner"));
    const { reportId } = await payWithTestProvider(ownerPage);
    await ownerContext.close();

    // Без входа — редирект на страницу входа (уже было, но проверяем явно), а не голая 404.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/report/${reportId}`);
    await anonPage.waitForURL("**/login**", { timeout: 15_000 });
    await anonContext.close();

    // Другой аккаунт, вошедший в систему, — понятное объяснение и кнопка «Мои отчёты», а не 404.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await quickStartToTeaser(otherPage);
    await registerToCheckout(otherPage, uniqueLogin("resil-other"));
    await otherPage.goto(`/report/${reportId}`);
    await expect(otherPage.getByText(/Доступ закрыт|Kirish yopiq/)).toBeVisible();
    await expect(otherPage.getByRole("link", { name: /Мои отчёты|Mening hisobotlarim/ })).toBeVisible();
    // Не 404 движка Next.js и не «Страница не найдена» — своя, конкретная причина.
    await expect(otherPage.getByText(/Страница не найдена|Sahifa topilmadi/)).toHaveCount(0);
    await otherContext.close();
  });
});

test.describe("устойчивость теста при обрыве сети (этап C2)", () => {
  test("потеря связи во время теста: статус сохранения и восстановление без потери ответов", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/start");
    await page.locator('button[name="pathType"][value="knows_goal"]').click();
    await page.waitForURL("**/test");
    // Экран подготовки — один клик «Начать тест».
    const startBtn = page.getByRole("button", { name: /Начать тест|Testni boshlash/ });
    if (await startBtn.count()) await startBtn.click();

    // Шкала-круги (этап 2а): группа радиокнопок, у каждого круга имя — полная подпись варианта.
    const options = page.getByRole("radiogroup").getByRole("radio");

    // Первый ответ — обычная сеть, должен сохраниться.
    await options.nth(0).click();
    await expect(page.getByText(/Сохранено|Saqlandi/)).toBeVisible({ timeout: 10_000 });

    // Обрыв сети: следующий ответ уходит в очередь, статус — «не удалось сохранить».
    await context.setOffline(true);
    await options.nth(1).click();
    await expect(page.getByText(/Не удалось сохранить|Saqlab boʻlmadi/)).toBeVisible({ timeout: 10_000 });

    // Связь вернулась — автоматический повтор, статус возвращается к «сохранено», ничего не потеряно.
    await context.setOffline(false);
    await expect(page.getByText(/Сохранено|Saqlandi/)).toBeVisible({ timeout: 10_000 });

    // Обновление страницы: оба ответа дошли до сервера, продолжаем с третьего вопроса, а не
    // откатываемся назад и не теряем то, что было отвечено при обрыве связи.
    await page.reload();
    await expect(page.getByText("3/60")).toBeVisible({ timeout: 10_000 });
  });
});
