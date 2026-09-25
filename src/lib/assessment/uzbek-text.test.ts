import { describe, expect, it } from "vitest";
import { isUzKey, normalizeUzApostrophes, normalizeUzFields } from "./uzbek-text";

describe("normalizeUzApostrophes", () => {
  it("o' и g' превращает в oʻ и gʻ (U+02BB)", () => {
    expect(normalizeUzApostrophes("Ko'p vaziyatlarda o'zimni")).toBe("Koʻp vaziyatlarda oʻzimni");
    expect(normalizeUzApostrophes("g'oyalar")).toBe("gʻoyalar");
  });

  it("заглавные O' и G' тоже", () => {
    expect(normalizeUzApostrophes("O'z fikrim. G'alaba")).toBe("Oʻz fikrim. Gʻalaba");
  });

  it("gʻ в конце слова (mablag')", () => {
    expect(normalizeUzApostrophes("qancha mablag' ajrata olasan")).toBe("qancha mablagʻ ajrata olasan");
  });

  it("остальные апострофы внутри слова — ʼ (U+02BC), а не ʻ", () => {
    expect(normalizeUzApostrophes("ta'lim")).toBe("taʼlim");
    expect(normalizeUzApostrophes("ma'no")).toBe("maʼno");
    expect(normalizeUzApostrophes("E'tirof va e'tibor")).toBe("Eʼtirof va eʼtibor");
    expect(normalizeUzApostrophes("An'anaviy")).toBe("Anʼanaviy");
  });

  it("одинарные кавычки вокруг слова не трогает", () => {
    expect(normalizeUzApostrophes("bu 'sovuq' so'z")).toBe("bu 'sovuq' soʻz");
    expect(normalizeUzApostrophes("'sovuq'")).toBe("'sovuq'");
    // Внутри кавычек буквы всё равно исправляются.
    expect(normalizeUzApostrophes("'o'zbek' tili")).toBe("'oʻzbek' tili");
    expect(normalizeUzApostrophes("'tog'")).toBe("'tog'");
  });

  it("строку без апострофов возвращает без изменений", () => {
    expect(normalizeUzApostrophes("Neytral")).toBe("Neytral");
    expect(normalizeUzApostrophes("")).toBe("");
  });

  it("повторный вызов ничего не портит", () => {
    const once = normalizeUzApostrophes("o'qish, ta'lim, mablag'");
    expect(normalizeUzApostrophes(once)).toBe(once);
  });
});

describe("normalizeUzFields", () => {
  it("определяет узбекские поля по имени", () => {
    for (const key of ["uz", "text_uz", "label_uz", "nickname_uz_lat", "title_uz"]) {
      expect(isUzKey(key), key).toBe(true);
    }
    for (const key of ["ru", "text_ru", "value", "uzbek", "busy"]) {
      expect(isUzKey(key), key).toBe(false);
    }
  });

  it("меняет только узбекские поля, в том числе вложенные и списки", () => {
    const input = {
      text_ru: "Don't touch",
      text_uz: "o'qish",
      options: [{ value: "a'b", label_uz: "Ko'proq", label_ru: "Скорее" }],
      uz: { title: "ta'lim", list: ["g'oya"] },
      id: 1,
      flag: true,
    };
    expect(normalizeUzFields(input)).toEqual({
      text_ru: "Don't touch",
      text_uz: "oʻqish",
      options: [{ value: "a'b", label_uz: "Koʻproq", label_ru: "Скорее" }],
      uz: { title: "taʼlim", list: ["gʻoya"] },
      id: 1,
      flag: true,
    });
  });
});
