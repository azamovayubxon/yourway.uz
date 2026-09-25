import { afterEach, describe, expect, it, vi } from "vitest";
import { devToolsEnabled } from "@/lib/dev";
import { dedupeLast, isValidAnswer, rowsToAnswers } from "./answers";

describe("проверка ответа из браузера", () => {
  it("принимает существующий вопрос и ответ 1–5", () => {
    expect(isValidAnswer({ test: "big_five", questionId: 60, value: 1 })).toBe(true);
    expect(isValidAnswer({ test: "perception", questionId: 8, value: 5 })).toBe(true);
  });

  it("отклоняет неизвестный тест, несуществующий вопрос и ответ вне 1–5", () => {
    expect(isValidAnswer({ test: "mbti", questionId: 1, value: 3 })).toBe(false);
    expect(isValidAnswer({ test: "values", questionId: 13, value: 3 })).toBe(false);
    expect(isValidAnswer({ test: "values", questionId: 1, value: 0 })).toBe(false);
    expect(isValidAnswer({ test: "values", questionId: 1, value: 6 })).toBe(false);
    expect(isValidAnswer({ test: "values", questionId: 1, value: 2.5 })).toBe(false);
    expect(isValidAnswer({ test: "values", questionId: "1", value: 3 })).toBe(false);
    expect(isValidAnswer(null)).toBe(false);
  });

  it("строки базы превращаются в ответы по тестам", () => {
    expect(
      rowsToAnswers([
        { test: "riasec", questionId: 2, value: 4 },
        { test: "riasec", questionId: 3, value: 1 },
        { test: "values", questionId: 1, value: 5 },
        { test: "unknown", questionId: 1, value: 5 },
      ]),
    ).toEqual({ riasec: { 2: 4, 3: 1 }, values: { 1: 5 } });
  });
});

describe("страницы /dev", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("на Vercel закрыты только на боевом сайте (production), на превью открыты", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(devToolsEnabled()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(devToolsEnabled()).toBe(true);
  });

  it("вне Vercel закрыты при NODE_ENV=production", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(devToolsEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(devToolsEnabled()).toBe(true);
  });
});

describe("пачка ответов для сохранения одним запросом", () => {
  it("повтор одного вопроса в пачке: остаётся последний ответ", () => {
    const batch = dedupeLast(
      [
        { test: "big_five", questionId: 1, value: 2 },
        { test: "riasec", questionId: 1, value: 3 },
        { test: "big_five", questionId: 1, value: 5 },
      ],
      (a) => `${a.test}:${a.questionId}`,
    );
    expect(batch).toEqual([
      { test: "big_five", questionId: 1, value: 5 },
      { test: "riasec", questionId: 1, value: 3 },
    ]);
  });
});
