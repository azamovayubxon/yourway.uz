import { describe, expect, it } from "vitest";
import { MOCK_TEASERS } from "./mock-teasers";
import { countSentences, extractJson, matchesLanguage, validateTeaser } from "./teaser-schema";

const golden = MOCK_TEASERS.ru;

describe("проверка ответа ИИ для тизера", () => {
  it("golden example (RU) и его перевод (UZ) проходят проверку", () => {
    expect(validateTeaser(MOCK_TEASERS.ru, "ru")).toMatchObject({ ok: true });
    expect(validateTeaser(MOCK_TEASERS.uz, "uz")).toMatchObject({ ok: true });
  });

  it("отклоняет ответ без обязательного поля", () => {
    const { surprise_hook: _, ...rest } = golden;
    expect(validateTeaser(rest, "ru")).toMatchObject({ ok: false, error: expect.stringContaining("surprise_hook") });
  });

  // Решение владельца (сентябрь 2026, этап B2а): ровно 3 сильные стороны, ровно 3 направления.
  it("требует ровно 3 направления — не 2, не 4", () => {
    expect(validateTeaser({ ...golden, fitting_directions: golden.fitting_directions.slice(0, 2) }, "ru").ok).toBe(
      false,
    );
    expect(
      validateTeaser({ ...golden, fitting_directions: [...golden.fitting_directions, golden.fitting_directions[0]] }, "ru")
        .ok,
    ).toBe(false);
  });

  it("требует ровно 3 сильные стороны", () => {
    expect(validateTeaser({ ...golden, top_strengths: golden.top_strengths.slice(0, 2) }, "ru").ok).toBe(false);
  });

  it("вывод (portrait) — ровно 2–3 предложения", () => {
    expect(countSentences(golden.portrait)).toBeGreaterThanOrEqual(2);
    expect(countSentences(golden.portrait)).toBeLessThanOrEqual(3);
    const oneSentence = { ...golden, portrait: "Только одно предложение." };
    expect(validateTeaser(oneSentence, "ru")).toMatchObject({ ok: false, error: "rule:portrait_sentences" });
    const fourSentences = { ...golden, portrait: "Раз. Два. Три. Четыре." };
    expect(validateTeaser(fourSentences, "ru")).toMatchObject({ ok: false, error: "rule:portrait_sentences" });
  });

  // Защита на время между merge и активацией новой версии промпта в /admin/prompts (см. §10
  // docs/prilozhenie-b-prompty.md): старый активный промпт не просит ИИ про trial_task/free_step,
  // и без этой мягкости обычная генерация тизера ломалась бы для всех до нажатия кнопки в админке.
  it("trial_task и free_step необязательны (совместимость со старой версией промпта)", () => {
    const withoutOptionalFields = {
      ...golden,
      free_step: undefined,
      fitting_directions: golden.fitting_directions.map(({ trial_task: _trial_task, ...rest }) => rest),
    };
    expect(validateTeaser(withoutOptionalFields, "ru")).toMatchObject({ ok: true });
  });

  it("не пропускает суммы в тексте тизера (правило 5)", () => {
    const bad = { ...golden, portrait: golden.portrait + " Уже через год — 2000$ в месяц." };
    expect(validateTeaser(bad, "ru")).toMatchObject({ ok: false, error: "rule:money_in_teaser" });
    const bad2 = {
      ...golden,
      fitting_directions: [
        { title: "Дизайн", one_liner: "доход от 10 млн сум", trial_task: golden.fitting_directions[0].trial_task },
        golden.fitting_directions[1],
        golden.fitting_directions[2],
      ],
    };
    expect(validateTeaser(bad2, "ru")).toMatchObject({ ok: false, error: "rule:money_in_teaser" });
  });

  it("не пропускает заглушки вроде [вставьте ...]", () => {
    expect(validateTeaser({ ...golden, surprise_hook: "[вставьте крючок]" }, "ru")).toMatchObject({
      ok: false,
      error: "rule:placeholder",
    });
  });

  it("проверяет язык: русский тизер для uz и наоборот не проходит", () => {
    expect(validateTeaser(MOCK_TEASERS.ru, "uz")).toMatchObject({ ok: false, error: "rule:language_not_uz" });
    expect(validateTeaser(MOCK_TEASERS.uz, "ru")).toMatchObject({ ok: false, error: "rule:language_not_ru" });
    expect(matchesLanguage("Продуктовый UX-дизайн и no-code", "ru")).toBe(true);
  });

  it("возвращает все найденные проблемы понятным текстом (для повтора и /dev/ai-log)", () => {
    const bad = {
      ...MOCK_TEASERS.uz,
      personality_type_label: "Pragmatist",
      // Без нового предложения (без точки после «Sen kuchlisan») — иначе число предложений
      // выйдет за пределы 2–3 и основной проблемой станет не «sen», а число предложений.
      portrait: "Sen kuchlisan " + MOCK_TEASERS.uz.portrait,
    };
    const result = validateTeaser(bad, "uz", { stopWords: ["pragmatist"], forbiddenPhrases: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("rule:uz_english:Pragmatist");
    expect(result.problems).toEqual([
      "английское слово — нужно узбекское: «Pragmatist»",
      "обращение на «sen» — нужна форма на «siz»: «Sen»",
      "обращение на «sen» — нужна форма на «siz»: «kuchlisan»",
    ]);
  });

  it("достаёт JSON из обёртки ```json и текста вокруг", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Вот ответ: {"a":1} спасибо')).toEqual({ a: 1 });
    expect(() => extractJson("нет json")).toThrow();
  });
});
