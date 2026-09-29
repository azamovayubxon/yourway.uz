import { describe, expect, it } from "vitest";
import { estimateMinutes, fmt, fmtCount } from "./format";

describe("fmt / fmtCount", () => {
  it("подставляет значения", () => {
    expect(fmt("Вопрос {n} из {total}", { n: 3, total: 60 })).toBe("Вопрос 3 из 60");
  });

  it("русские формы числа", () => {
    const t = "{n} вопрос|{n} вопроса|{n} вопросов";
    expect([1, 2, 5, 8, 11, 12, 21, 22, 30, 60, 101, 111].map((n) => fmtCount(t, n))).toEqual([
      "1 вопрос",
      "2 вопроса",
      "5 вопросов",
      "8 вопросов",
      "11 вопросов",
      "12 вопросов",
      "21 вопрос",
      "22 вопроса",
      "30 вопросов",
      "60 вопросов",
      "101 вопрос",
      "111 вопросов",
    ]);
  });

  it("строка без «|» (узбекский) — одна форма", () => {
    expect(fmtCount("{n} ta savol", 30)).toBe("30 ta savol");
  });

  it("примерная длительность: ~11 секунд на вопрос, минимум 1 минута", () => {
    expect(estimateMinutes(110)).toBe(20);
    expect(estimateMinutes(60)).toBe(11);
    expect(estimateMinutes(30)).toBe(6);
    expect(estimateMinutes(12)).toBe(2);
    expect(estimateMinutes(8)).toBe(1);
    expect(estimateMinutes(1)).toBe(1);
  });
});
