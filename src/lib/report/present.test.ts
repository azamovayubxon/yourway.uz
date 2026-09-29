import { describe, expect, it, vi } from "vitest";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";

// "server-only" ломается в обычном Node (не в сборке Next.js) — заглушаем, как в
// src/lib/report/ownership.test.ts. present.ts тянет его транзитивно через @/lib/payments.
vi.mock("server-only", () => ({}));

const { presentReport, reportLanguageNote, buildFirstScreen, reportTypeLabel } = await import("./present");

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

describe("buildFirstScreen — компактный первый экран (ТЗ аудита §9), без новой генерации", () => {
  const content = {
    portrait: { summary: "Вы любите разбираться в деталях. Это помогает в аналитике. Третье предложение не нужно." },
    goal: { statement: "Стать аналитиком данных" },
    main_path: {
      routes: [{ time_estimate: "6–9 месяцев", cost_range: "0–2 млн сум", requirements: ["английский B1"] }],
    },
    act_now: ["Пройти бесплатный курс по SQL"],
  } as unknown as Parameters<typeof buildFirstScreen>[0];

  it("берёт первые два предложения портрета, а не весь текст", () => {
    expect(buildFirstScreen(content).takeaway).toBe("Вы любите разбираться в деталях. Это помогает в аналитике.");
  });

  it("направление и первый шаг — уже существующие поля отчёта", () => {
    const s = buildFirstScreen(content);
    expect(s.direction).toBe("Стать аналитиком данных");
    expect(s.firstStep).toBe("Пройти бесплатный курс по SQL");
  });

  it("ограничения — из первого варианта маршрута", () => {
    expect(buildFirstScreen(content).constraints).toBe("6–9 месяцев · 0–2 млн сум · английский B1");
  });
});

describe("buildFirstScreen — report-2.0: takeaway и limitations как отдельные поля (этап C1)", () => {
  const oldContent = {
    portrait: { summary: "Первое предложение. Второе предложение. Третье не нужно." },
    goal: { statement: "Стать аналитиком данных" },
    main_path: {
      routes: [{ time_estimate: "6–9 месяцев", cost_range: "0–2 млн сум", requirements: ["английский B1"] }],
    },
    act_now: ["Пройти бесплатный курс по SQL"],
  } as unknown as Parameters<typeof buildFirstScreen>[0];

  it("старый отчёт (report-1.0, нет takeaway/limitations) отображается как раньше", () => {
    const s = buildFirstScreen(oldContent);
    expect(s.takeaway).toBe("Первое предложение. Второе предложение.");
    expect(s.constraints).toBe("6–9 месяцев · 0–2 млн сум · английский B1");
  });

  it("новый отчёт (report-2.0): takeaway и main_path.limitations — отдельные поля, не вырезка из текста", () => {
    const newContent = {
      ...oldContent,
      takeaway: "Готовый краткий вывод от ИИ, а не вырезка из портрета.",
      main_path: { ...oldContent.main_path, limitations: ["Бюджет ограничен", "Нужен английский B1"] },
    } as unknown as Parameters<typeof buildFirstScreen>[0];
    const s = buildFirstScreen(newContent);
    expect(s.takeaway).toBe("Готовый краткий вывод от ИИ, а не вырезка из портрета.");
    expect(s.constraints).toBe("Бюджет ограничен · Нужен английский B1");
  });
});

describe("reportTypeLabel — один источник названия типа для страницы отчёта и обложки PDF", () => {
  const content = { portrait: { type_label: "Тип из отчёта" } } as Parameters<typeof reportTypeLabel>[0]["content"];

  it("берёт название из бесплатного результата (тизера), если оно там есть", () => {
    expect(reportTypeLabel({ teaser: { personality_type_label: "Izlanuvchan ijodkor" }, content, locale: "ru" })).toEqual({
      label: "Izlanuvchan ijodkor",
      lang: "uz", // язык строки — по самой строке (тизер мог быть на другом языке, чем отчёт)
    });
    expect(reportTypeLabel({ teaser: { personality_type_label: " Исследователь-Творец " }, content, locale: "uz" })).toEqual({
      label: "Исследователь-Творец",
      lang: "ru",
    });
  });

  it("без тизера или с пустым названием — из портрета самого отчёта, на языке отчёта", () => {
    for (const teaser of [null, undefined, {}, { personality_type_label: "  " }, { personality_type_label: 42 }]) {
      expect(reportTypeLabel({ teaser, content, locale: "ru" })).toEqual({ label: "Тип из отчёта", lang: "ru" });
    }
    expect(reportTypeLabel({ teaser: null, content, locale: "uz" }).lang).toBe("uz");
  });

  it("страница отчёта и PDF берут название только через reportTypeLabel", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["src/app/report/[id]/page.tsx", "src/app/api/report/[id]/pdf/route.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toMatch(/reportTypeLabel\(\{ teaser: report\.teaser, content, locale: report\.locale \}\)/);
      expect(source, file).not.toMatch(/personality_type_label|portrait\.type_label/);
    }
  });
});
