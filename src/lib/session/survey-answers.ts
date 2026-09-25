import { SURVEY_QUESTIONS, surveyQuestionsFor, type SurveyQuestion } from "@/lib/assessment/survey";
import type { PathType } from "@/lib/assessment/tests";

// Проверка ответа опроса, пришедшего из браузера.

export interface SurveyAnswerInput {
  questionId: string;
  value: number | string | string[];
}

function isValidValue(question: SurveyQuestion, value: unknown): value is number | string | string[] {
  switch (question.type) {
    case "number":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        (question.input.min === undefined || value >= question.input.min) &&
        (question.input.max === undefined || value <= question.input.max)
      );
    case "single_select":
      return typeof value === "string" && question.options.some((o) => o.value === value);
    case "multi_select":
      return (
        Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every((v) => typeof v === "string" && question.options.some((o) => o.value === v)) &&
        (!question.required || value.length > 0)
      );
    case "text":
      // Пустая строка у необязательного вопроса — явный пропуск («Пропустить»).
      return (
        typeof value === "string" &&
        value.length <= (question.input.maxLen ?? 1000) &&
        (question.required ? value.trim().length > 0 : true)
      );
  }
}

export function isValidSurveyAnswer(pathType: PathType, a: unknown): a is SurveyAnswerInput {
  if (!a || typeof a !== "object") return false;
  const { questionId, value } = a as Record<string, unknown>;
  if (typeof questionId !== "string") return false;
  const question = SURVEY_QUESTIONS[questionId];
  // Вопрос должен существовать и относиться к набору для этого пути (напр. блок «Цель» — только knows_goal).
  if (!question || !surveyQuestionsFor(pathType).some((q) => q.id === questionId)) return false;
  return isValidValue(question, value);
}
