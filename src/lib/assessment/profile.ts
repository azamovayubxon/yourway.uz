// Сборка итогового профиля для промптов ИИ (Приложение А §9) из баллов тестов и ответов опроса.
// Формат — строго по кодам из опроса (Приложение А §9, решение (Д) в CLAUDE.md), а не по
// человекочитаемому примеру из Приложения Б §9 (тот — только пример входа).

import type { Locale } from "@/i18n/config";
import { answerQuality, type AnswerQuality } from "./answer-quality";
import { computeScores, type Answers, type Scores } from "./scoring";
import { SURVEY_QUESTIONS } from "./survey";
import type { PathType } from "./tests";

export type SurveyValue = number | string | string[];

export interface SurveyAnswerRow {
  questionId: string;
  value: unknown;
}

export interface Profile {
  language: Locale;
  path_type: PathType;
  // Уровень по умолчанию от развилки (решение (В)): knows_goal → route, no_goal → navigator.
  // При оплате заменяется выбранным пользователем уровнем (этап 6).
  level: "route" | "navigator";

  demographics: { age: number; gender: string };

  big_five: Scores["big_five"];
  sixteen_type: { code: string; nickname: string };
  riasec: Scores["riasec"];
  values_ranked: string[];
  // Решение (Ж): сырые суммы баллов рядом с ранжированием — чтобы ИИ видел, где значения равны.
  values_scores: Scores["values_scores"];
  learning_style: Scores["learning_style"];
  learning_style_scores: Scores["learning_style_scores"];

  resources: Record<string, SurveyValue>;
  // Есть только у path_type = knows_goal (Приложение А §9): для no_goal цель конструирует ИИ.
  goal?: Record<string, SurveyValue>;

  // Не часть Приложения А §9: для ИИ и аналитики, пользователю не показывается (пункт 3 задачи этапа 3).
  answer_quality: AnswerQuality | null;
}

function setPath(root: Record<string, Record<string, SurveyValue>>, path: string, value: SurveyValue) {
  const [group, key] = path.split(".");
  (root[group] ??= {})[key] = value;
}

// Разбирает ответы опроса в объект { demographics: {...}, resources: {...}, goal: {...} } по maps_to.
// Пустая строка у необязательного текстового вопроса — явный пропуск, в профиль не попадает.
function assembleSurveyValues(rows: SurveyAnswerRow[]): Record<string, Record<string, SurveyValue>> {
  const root: Record<string, Record<string, SurveyValue>> = {};
  for (const row of rows) {
    const question = SURVEY_QUESTIONS[row.questionId];
    if (!question) continue;
    if (question.type === "text" && row.value === "") continue;
    root[question.mapsTo.split(".")[0]] ??= {};
    setPath(root, question.mapsTo, row.value as SurveyValue);
  }
  return root;
}

export function buildProfile(
  pathType: PathType,
  locale: Locale,
  answers: Answers,
  surveyRows: SurveyAnswerRow[],
): Profile {
  const scores = computeScores(answers);
  const values = assembleSurveyValues(surveyRows);

  const demographics = (values.demographics ?? {}) as unknown as { age: number; gender: string };
  const resources = values.resources ?? {};
  const goal = values.goal;

  return {
    language: locale,
    path_type: pathType,
    level: pathType === "knows_goal" ? "route" : "navigator",
    demographics,
    big_five: scores.big_five,
    sixteen_type: { code: scores.sixteen_type.code, nickname: scores.sixteen_type.nickname[locale] },
    riasec: scores.riasec,
    values_ranked: scores.values_ranked,
    values_scores: scores.values_scores,
    learning_style: scores.learning_style,
    learning_style_scores: scores.learning_style_scores,
    resources,
    ...(pathType === "knows_goal" && goal ? { goal } : {}),
    answer_quality: answerQuality(answers),
  };
}
