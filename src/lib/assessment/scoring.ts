// Движок подсчёта баллов (Приложение А §3–§6, решения (А), (Е), (Ж) в CLAUDE.md).
// Детерминированный код без ИИ: одинаковые ответы всегда дают одинаковый результат.

import { SCALE_ORDER, SIXTEEN_TYPES, TESTS, type LocalizedText, type TestDefinition, type TestId } from "./tests";

// Ответы: тест → номер вопроса → ответ 1–5.
export type Answers = Partial<Record<TestId, Record<number, number>>>;

export const BIG_FIVE_SCALES = ["neuroticism", "extraversion", "openness", "agreeableness", "conscientiousness"] as const;
export type BigFiveScale = (typeof BIG_FIVE_SCALES)[number];
export type Level = "low" | "medium" | "high";

export interface Scores {
  big_five: Record<BigFiveScale, number>; // проценты 0–100
  big_five_raw: Record<BigFiveScale, number>; // суммы 12–60
  big_five_levels: Record<BigFiveScale, Level>;
  sixteen_type: {
    code: string;
    nickname: LocalizedText;
    // Оси, где |pct − 50| ≤ 5. Только для внутренних данных, пользователю не показывается.
    weak_axes: string[];
  };
  riasec: { code: string; scores: Record<string, number> };
  values_ranked: string[];
  values_scores: Record<string, number>;
  learning_style: string | [string, string];
  learning_style_scores: Record<string, number>;
}

export class IncompleteAnswersError extends Error {}

function assertAnswer(value: number | undefined, where: string): number {
  if (value === undefined) throw new IncompleteAnswersError(`Нет ответа: ${where}`);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(`Ответ должен быть целым числом 1–5: ${where} = ${value}`);
  }
  return value;
}

// Суммы по шкалам теста. Для обратных пунктов балл = 6 − ответ.
export function sumByScale(test: TestDefinition, answers: Record<number, number> | undefined): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const q of test.questions) {
    const answer = assertAnswer(answers?.[q.id], `${test.id} #${q.id}`);
    const points = q.reverse ? 6 - answer : answer;
    sums[q.scale] = (sums[q.scale] ?? 0) + points;
  }
  return sums;
}

// Сортировка по убыванию суммы. При равных суммах — порядок из файла теста (`order`).
// Сортировка в JS стабильная, поэтому достаточно отсортировать список, уже стоящий в порядке файла.
export function rankByScore(sums: Record<string, number>, order: string[]): string[] {
  return [...order].sort((a, b) => sums[b] - sums[a]);
}

// Big Five: 12 пунктов на шкалу, raw 12–60 → pct = round((raw − 12) / 48 × 100).
export function bigFivePercent(raw: number): number {
  return Math.round(((raw - 12) / 48) * 100);
}

// Уровень шкалы по процентам, третями: 0–33 низкий, 34–66 средний, 67–100 высокий.
// (Диапазоны raw/percentile из `interpretation.scales` файла не используются: они от версии на 120 пунктов.)
export function levelOf(pct: number): Level {
  if (pct <= 33) return "low";
  if (pct <= 66) return "medium";
  return "high";
}

// 16-тип из процентов Big Five. Порог 50.
// Решение (А): ровно 50 уходит в low pole (I, S, T, P). Правило: pct > 50 → high pole, иначе low pole.
// Формулу `>= 50` из Приложения А и из `algorithm_pseudocode` mapping-файла сознательно не используем.
const AXES = [
  { axis: "E_I", scale: "extraversion", high: "E", low: "I" },
  { axis: "S_N", scale: "openness", high: "N", low: "S" },
  { axis: "T_F", scale: "agreeableness", high: "F", low: "T" },
  { axis: "J_P", scale: "conscientiousness", high: "J", low: "P" },
] as const;

export function sixteenType(bigFive: Record<BigFiveScale, number>): Scores["sixteen_type"] {
  let code = "";
  const weak_axes: string[] = [];
  for (const a of AXES) {
    const pct = bigFive[a.scale];
    code += pct > 50 ? a.high : a.low;
    if (Math.abs(pct - 50) <= 5) weak_axes.push(a.axis);
  }
  return { code, nickname: SIXTEEN_TYPES[code], weak_axes };
}

// Стиль обучения, решение (Е): один стиль — строка; если разница с ближайшим ≤ 1 балла — список из двух.
export function learningStyle(sums: Record<string, number>, order: string[]): string | [string, string] {
  const [first, second] = rankByScore(sums, order);
  return sums[first] - sums[second] <= 1 ? [first, second] : first;
}

export function computeScores(answers: Answers): Scores {
  const byId = Object.fromEntries(TESTS.map((t) => [t.id, t])) as Record<TestId, TestDefinition>;

  // 1. Big Five
  const bfRaw = sumByScale(byId.big_five, answers.big_five);
  const big_five_raw = {} as Record<BigFiveScale, number>;
  const big_five = {} as Record<BigFiveScale, number>;
  const big_five_levels = {} as Record<BigFiveScale, Level>;
  for (const scale of BIG_FIVE_SCALES) {
    big_five_raw[scale] = bfRaw[scale];
    big_five[scale] = bigFivePercent(bfRaw[scale]);
    big_five_levels[scale] = levelOf(big_five[scale]);
  }

  // 2. RIASEC: код — топ-3 по убыванию суммы. При равных суммах порядок R→I→A→S→E→C.
  const riasecScores = sumByScale(byId.riasec, answers.riasec);
  const riasecOrdered = Object.fromEntries(SCALE_ORDER.riasec.map((k) => [k, riasecScores[k]]));
  const riasecCode = rankByScore(riasecScores, SCALE_ORDER.riasec).slice(0, 3).join("");

  // 3. Ценности: по убыванию суммы. При равных — money→freedom→stability→recognition→helping→creativity.
  const valuesSums = sumByScale(byId.values, answers.values);
  const values_scores = Object.fromEntries(SCALE_ORDER.values.map((k) => [k, valuesSums[k]]));

  // 4. Восприятие: при равных — reading→auditory→practice→repetition.
  const styleSums = sumByScale(byId.perception, answers.perception);
  const learning_style_scores = Object.fromEntries(SCALE_ORDER.perception.map((k) => [k, styleSums[k]]));

  return {
    big_five,
    big_five_raw,
    big_five_levels,
    sixteen_type: sixteenType(big_five),
    riasec: { code: riasecCode, scores: riasecOrdered },
    values_ranked: rankByScore(valuesSums, SCALE_ORDER.values),
    values_scores,
    learning_style: learningStyle(styleSums, SCALE_ORDER.perception),
    learning_style_scores,
  };
}

// Сколько вопросов уже отвечено (для прогресса и проверки «все тесты пройдены»).
export function countAnswered(answers: Answers): number {
  let n = 0;
  for (const test of TESTS) {
    for (const q of test.questions) if (answers[test.id]?.[q.id] !== undefined) n++;
  }
  return n;
}
