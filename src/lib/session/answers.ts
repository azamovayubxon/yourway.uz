import type { Answers } from "@/lib/assessment/scoring";
import { isTestId, isValidQuestion, type TestId } from "@/lib/assessment/tests";

// Проверка ответов, пришедших из браузера, и перевод строк базы в формат движка подсчёта.

export interface AnswerInput {
  test: TestId;
  questionId: number;
  value: number;
}

export function isValidAnswer(a: unknown): a is AnswerInput {
  if (!a || typeof a !== "object") return false;
  const { test, questionId, value } = a as Record<string, unknown>;
  return (
    isTestId(test) &&
    typeof questionId === "number" &&
    isValidQuestion(test, questionId) &&
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export function rowsToAnswers(rows: { test: string; questionId: number; value: number }[]): Answers {
  const answers: Answers = {};
  for (const r of rows) {
    if (!isTestId(r.test)) continue;
    (answers[r.test] ??= {})[r.questionId] = r.value;
  }
  return answers;
}

// Если в одной пачке один вопрос встречается дважды, оставляем последний ответ
// (иначе Postgres откажется обновлять одну строку дважды в одном запросе).
export function dedupeLast<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
