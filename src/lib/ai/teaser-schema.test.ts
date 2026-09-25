import { describe, expect, it } from "vitest";
import { MOCK_TEASERS } from "./mock-teasers";
import { extractJson, matchesLanguage, validateTeaser } from "./teaser-schema";

const golden = MOCK_TEASERS.ru;

describe("проверка ответа ИИ для тизера", () => {
  it("golden example (RU) и его перевод (UZ) проходят проверку", () => {
    expect(validateTeaser(MOCK_TEASERS.ru, "ru")).toMatchObject({ ok: true });
    expect(validateTeaser(MOCK_TEASERS.uz, "uz")).toMatchObject({ ok: true });
  });

  it("мягкая проверка оглавления: 7 пунктов принимаются, 3 — нет", () => {
    expect(golden.locked_toc).toHaveLength(7);
    expect(validateTeaser({ ...golden, locked_toc: golden.locked_toc.slice(0, 3) }, "ru")).toMatchObject({ ok: false });
  });

  it("отклоняет ответ без обязательного поля", () => {
    const { surprise_hook: _, ...rest } = golden;
    expect(validateTeaser(rest, "ru")).toMatchObject({ ok: false, error: expect.stringContaining("surprise_hook") });
  });

  it("требует 2–3 направления", () => {
    expect(validateTeaser({ ...golden, fitting_directions: golden.fitting_directions.slice(0, 1) }, "ru").ok).toBe(
      false,
    );
  });

  it("не пропускает суммы в тексте тизера (правило 5)", () => {
    const bad = { ...golden, portrait: golden.portrait + " Уже через год — 2000$ в месяц." };
    expect(validateTeaser(bad, "ru")).toEqual({ ok: false, error: "rule:money_in_teaser" });
    const bad2 = {
      ...golden,
      fitting_directions: [{ title: "Дизайн", one_liner: "доход от 10 млн сум" }, golden.fitting_directions[1]],
    };
    expect(validateTeaser(bad2, "ru")).toEqual({ ok: false, error: "rule:money_in_teaser" });
  });

  it("не пропускает заглушки вроде [вставьте ...]", () => {
    expect(validateTeaser({ ...golden, surprise_hook: "[вставьте крючок]" }, "ru")).toEqual({
      ok: false,
      error: "rule:placeholder",
    });
  });

  it("проверяет язык: русский тизер для uz и наоборот не проходит", () => {
    expect(validateTeaser(MOCK_TEASERS.ru, "uz")).toEqual({ ok: false, error: "rule:language_not_uz" });
    expect(validateTeaser(MOCK_TEASERS.uz, "ru")).toEqual({ ok: false, error: "rule:language_not_ru" });
    expect(matchesLanguage("Продуктовый UX-дизайн и no-code", "ru")).toBe(true);
  });

  it("достаёт JSON из обёртки ```json и текста вокруг", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Вот ответ: {"a":1} спасибо')).toEqual({ a: 1 });
    expect(() => extractJson("нет json")).toThrow();
  });
});
