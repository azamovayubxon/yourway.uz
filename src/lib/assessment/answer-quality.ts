// Флаг качества ответов (пункт 3 задачи этапа 3): если в каком-то тесте человек
// почти все ответы дал одной и той же кнопкой, это подозрительно (случайное/невнимательное
// прохождение). Пользователю не показывается — только для ИИ (Приложение Б) и аналитики.
//
// Смотрим именно на нажатую кнопку (1–5), а не на скорректированный балл: человек,
// нажимающий одну и ту же кнопку, физически не различает прямые и обратные пункты.

import type { Answers } from "./scoring";
import { TESTS, type TestId } from "./tests";

// Доля одинаковых ответов в тесте, начиная с которой считаем прохождение «плоским».
const FLAT_RATIO = 0.9;

export interface AnswerQuality {
  level: "low";
  // Тесты, в которых сработал признак.
  tests: TestId[];
}

export function answerQuality(answers: Answers): AnswerQuality | null {
  const tests: TestId[] = [];
  for (const test of TESTS) {
    const values = Object.values(answers[test.id] ?? {});
    if (values.length === 0) continue;
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const maxCount = Math.max(...counts.values());
    if (maxCount / values.length >= FLAT_RATIO) tests.push(test.id);
  }
  return tests.length > 0 ? { level: "low", tests } : null;
}
