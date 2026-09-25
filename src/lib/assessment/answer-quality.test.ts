import { describe, expect, it } from "vitest";
import { answerQuality } from "./answer-quality";
import type { Answers } from "./scoring";
import { TESTS } from "./tests";

// Собирает полный набор ответов для теста testId: pick(questionId) → ответ 1–5.
function buildTestAnswers(testId: (typeof TESTS)[number]["id"], pick: (id: number) => number): Answers {
  const test = TESTS.find((t) => t.id === testId)!;
  return { [testId]: Object.fromEntries(test.questions.map((q) => [q.id, pick(q.id)])) };
}

describe("флаг качества ответов: почти все ответы одной кнопкой", () => {
  it("все ответы одинаковые в одном тесте → флаг с этим тестом", () => {
    const answers = buildTestAnswers("perception", () => 3);
    const q = answerQuality(answers);
    expect(q).toEqual({ level: "low", tests: ["perception"] });
  });

  it("восприятие (8 вопросов): 1 другой ответ из 8 — ещё не флаг (87,5% < 90%)", () => {
    const answers = buildTestAnswers("perception", (id) => (id === 1 ? 5 : 3));
    expect(answerQuality(answers)).toBeNull();
  });

  it("ценности (12 вопросов): 1 другой ответ из 12 — уже флаг (91,7% ≥ 90%)", () => {
    const answers = buildTestAnswers("values", (id) => (id === 1 ? 5 : 3));
    expect(answerQuality(answers)).toEqual({ level: "low", tests: ["values"] });
  });

  it("обычные разнообразные ответы — флага нет", () => {
    const answers = buildTestAnswers("riasec", (id) => (id % 5) + 1);
    expect(answerQuality(answers)).toBeNull();
  });

  it("несколько тестов сразу — все перечислены", () => {
    const answers: Answers = {
      ...buildTestAnswers("big_five", () => 3),
      ...buildTestAnswers("perception", () => 1),
    };
    expect(answerQuality(answers)).toEqual({ level: "low", tests: ["big_five", "perception"] });
  });

  it("пустые ответы — флага нет", () => {
    expect(answerQuality({})).toBeNull();
  });
});
