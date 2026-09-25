import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultLocale, isLocale } from "./config";
import { ru } from "./dictionaries/ru";
import { uz } from "./dictionaries/uz";

// Собирает все строки словаря вместе с путём к ним: "landing.hero.title" → "...".
function flatten(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value as object)) {
    Object.assign(out, flatten(child, path ? `${path}.${key}` : key));
  }
  return out;
}

describe("словари UZ/RU", () => {
  const ruFlat = flatten(ru);
  const uzFlat = flatten(uz);

  it("содержат одинаковый набор ключей (включая длину списков)", () => {
    expect(Object.keys(uzFlat).sort()).toEqual(Object.keys(ruFlat).sort());
  });

  it("не содержат пустых строк", () => {
    for (const [key, text] of [...Object.entries(ruFlat), ...Object.entries(uzFlat)]) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("узбекские тексты не используют обычный апостроф вместо ʻ и ʼ", () => {
    for (const [key, text] of Object.entries(uzFlat)) {
      expect(text, key).not.toMatch(/['`‘’]/);
    }
  });

  it("знак ʻ (U+02BB) стоит только после o/g: oʻ, gʻ", () => {
    for (const [key, text] of Object.entries(uzFlat)) {
      expect(text, key).not.toMatch(/(^|[^oOgG])ʻ/);
    }
  });
});

describe("язык по умолчанию", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("распознаёт только uz и ru", () => {
    expect(isLocale("uz")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("берётся из DEFAULT_LOCALE, иначе uz", () => {
    vi.stubEnv("DEFAULT_LOCALE", "ru");
    expect(getDefaultLocale()).toBe("ru");
    vi.stubEnv("DEFAULT_LOCALE", "xx");
    expect(getDefaultLocale()).toBe("uz");
    vi.stubEnv("DEFAULT_LOCALE", "");
    expect(getDefaultLocale()).toBe("uz");
  });
});
