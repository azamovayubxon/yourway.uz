import { describe, expect, it } from "vitest";
import {
  formatRecoveryCode,
  generateRecoveryCode,
  normalizeLogin,
  normalizeRecoveryCode,
  safeNextPath,
  validateLogin,
  validatePassword,
} from "./credentials";

describe("логин", () => {
  it("приводится к нижнему регистру без пробелов по краям", () => {
    expect(normalizeLogin("  Aziz_2008 ")).toBe("aziz_2008");
  });

  it("допускает латиницу, цифры, точку, _ и -, от 3 до 32 символов", () => {
    for (const ok of ["abc", "aziz_2008", "a.b-c", "007", "x".repeat(32)]) {
      expect(validateLogin(ok), ok).toBeNull();
    }
  });

  it("отклоняет короткие, длинные, кириллицу, пробелы и спецсимвол в начале", () => {
    for (const bad of ["", "ab", "x".repeat(33), "азиз", "aziz ali", "_aziz", ".aziz", "-aziz", "aziz@mail", "oʻgʻil"]) {
      expect(validateLogin(bad), bad).toBe("login_invalid");
    }
  });
});

describe("пароль", () => {
  it("не короче 8 символов", () => {
    expect(validatePassword("1234567", "aziz")).toBe("password_short");
    expect(validatePassword("12345678", "aziz")).toBeNull();
  });

  it("длина считается в символах: узбекские буквы и эмодзи — по одному", () => {
    expect(validatePassword("oʻgʻ🙂🙂🙂", "aziz")).toBe("password_short");
    expect(validatePassword("пароль🙂🙂", "aziz")).toBeNull();
  });

  it("не длиннее 128 символов", () => {
    expect(validatePassword("x".repeat(128), "aziz")).toBeNull();
    expect(validatePassword("x".repeat(129), "aziz")).toBe("password_long");
  });

  it("не совпадает с логином (без учёта регистра)", () => {
    expect(validatePassword("Aziz_2008", "aziz_2008")).toBe("password_same_as_login");
  });
});

describe("код восстановления", () => {
  it("16 символов по 4 через дефис, без путающихся букв I, L, O, U", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    }
  });

  it("каждый раз новый", () => {
    const codes = new Set(Array.from({ length: 100 }, generateRecoveryCode));
    expect(codes.size).toBe(100);
  });

  it("при вводе прощает пробелы, строчные буквы и путаницу O/0, I/1, L/1", () => {
    expect(normalizeRecoveryCode("7K3F-9QXM-B2RD-TW4H")).toBe("7K3F9QXMB2RDTW4H");
    expect(normalizeRecoveryCode(" 7k3f 9qxm b2rd tw4h ")).toBe("7K3F9QXMB2RDTW4H");
    expect(normalizeRecoveryCode("O0IL-0000-0000-0000")).toBe("0011000000000000");
  });

  it("возвращает null для неполного кода или чужих символов", () => {
    expect(normalizeRecoveryCode("7K3F-9QXM-B2RD")).toBeNull();
    expect(normalizeRecoveryCode("7K3F-9QXM-B2RD-TW4HX")).toBeNull();
    expect(normalizeRecoveryCode("7K3F-9QXM-B2RD-TW4U")).toBeNull();
    expect(normalizeRecoveryCode("")).toBeNull();
  });

  it("сгенерированный код проходит нормализацию и форматируется обратно в тот же вид", () => {
    const code = generateRecoveryCode();
    expect(formatRecoveryCode(normalizeRecoveryCode(code)!)).toBe(code);
  });
});

describe("адрес возврата после входа (?next=)", () => {
  it("пропускает адреса нашего сайта", () => {
    expect(safeNextPath("/pricing", "/account")).toBe("/pricing");
    expect(safeNextPath("/teaser?generate=1", "/account")).toBe("/teaser?generate=1");
  });

  it("не пропускает чужие сайты и мусор", () => {
    for (const bad of ["//evil.com", "https://evil.com", "evil.com", "/\\evil.com", "/a\nb", "", undefined, 42]) {
      expect(safeNextPath(bad, "/account")).toBe("/account");
    }
  });
});
