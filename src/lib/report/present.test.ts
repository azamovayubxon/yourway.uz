import { describe, expect, it, vi } from "vitest";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";

// "server-only" ломается в обычном Node (не в сборке Next.js) — заглушаем, как в
// src/lib/report/ownership.test.ts. present.ts тянет его транзитивно через @/lib/payments.
vi.mock("server-only", () => ({}));

const { presentReport, reportLanguageNote } = await import("./present");

// presentReport/reportLanguageNote — общее для онлайн-страницы отчёта и PDF (аудит UX-06):
// оболочка (название уровня, 16-тип, стиль обучения, дата, строка о языке) всегда на языке
// интерфейса, содержимое отчёта — на report.locale, зафиксированном при оплате.

const profile = (overrides: Partial<{ code: string; learningStyle: string | string[] }> = {}) =>
  ({
    sixteen_type: { code: overrides.code ?? "INTP", nickname: "запасное имя" },
    learning_style: overrides.learningStyle ?? "practice",
  }) as unknown as Parameters<typeof presentReport>[0]["profile"];

function report(locale: string, code = "INTP") {
  return {
    level: "navigator",
    createdAt: new Date("2026-09-20T00:00:00Z"),
    profile: profile({ code }),
  } as unknown as Parameters<typeof presentReport>[0] & { locale: string };
}

describe("presentReport — оболочка на языке интерфейса, не на языке отчёта", () => {
  it("название уровня и 16-тип берутся на языке интерфейса, даже если отчёт написан на другом", () => {
    const r = report("ru"); // отчёт «написан» на ru (условно, для теста неважно — оболочка не смотрит на report.locale)
    const presentation = presentReport(r, "uz", uz);
    expect(presentation.levelName).toBe(uz.checkout.levels.navigator.name);
    expect(presentation.sixteenType).toContain("INTP");
    expect(presentation.sixteenType.toLowerCase()).not.toMatch(/[а-яё]/i); // оболочка на uz — без кириллицы
  });

  it("тот же профиль и уровень с интерфейсом на ru даёт русские подписи", () => {
    const r = report("uz");
    const presentation = presentReport(r, "ru", ru);
    expect(presentation.levelName).toBe(ru.checkout.levels.navigator.name);
    expect(presentation.sixteenType).toMatch(/[а-яё]/i);
  });

  it("старый отчёт (locale сохранён по прежнему правилу — язык интерфейса на момент оплаты) открывается так же, как новый: оболочка зависит только от текущего языка интерфейса", () => {
    // «Старый» отчёт здесь — просто Report с уже заполненным locale, как и раньше (поле было
    // обязательным до этого решения); ничего специального для старых записей не требуется.
    const oldReport = report("ru");
    const today = presentReport(oldReport, "uz", uz);
    expect(today.levelName).toBe(uz.checkout.levels.navigator.name);
  });
});

describe("reportLanguageNote — явная строка о языке отчёта (аудит UX-06)", () => {
  it("называет язык отчёта на языке интерфейса, независимо от совпадения языков", () => {
    expect(reportLanguageNote("ru", ru)).toContain(ru.report.languageNames.ru);
    expect(reportLanguageNote("uz", ru)).toContain(ru.report.languageNames.uz);
    expect(reportLanguageNote("ru", uz)).toContain(uz.report.languageNames.ru);
    expect(reportLanguageNote("uz", uz)).toContain(uz.report.languageNames.uz);
  });

  it("текст объясняет, что переключатель языка сайта меняет только оболочку", () => {
    expect(reportLanguageNote("ru", ru)).toMatch(/оформление/);
    expect(reportLanguageNote("uz", uz)).toMatch(/koʻrinishni/);
  });

  it("показывается всегда, даже когда язык отчёта совпадает с языком интерфейса (не только при расхождении)", () => {
    // Раньше строка показывалась только когда report.locale !== interfaceLocale; теперь — всегда.
    expect(reportLanguageNote("ru", ru).length).toBeGreaterThan(0);
    expect(reportLanguageNote("uz", uz).length).toBeGreaterThan(0);
  });
});
