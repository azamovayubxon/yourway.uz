// Контекстный опрос: вопросы, разделы и правила показа берутся из data/tests/context_survey.json.
// Тексты не перепечатываются вручную. Узбекские апострофы исправляются при загрузке (как в tests.ts).
//
// Вопрос path_type сюда не попадает: он уже задан на экране-развилке до тестов
// (см. PATH_TYPE_QUESTION в tests.ts), в опросе его показывать не нужно (CLAUDE.md §4).

import surveyRaw from "../../../data/tests/context_survey.json";
import type { Locale } from "@/i18n/config";
import { normalizeUzFields } from "./uzbek-text";
import { isPathType, type PathType } from "./tests";

export type LocalizedText = Record<Locale, string>;

export type SurveyQuestionType = "number" | "single_select" | "multi_select" | "text";

export interface SurveyOption {
  value: string;
  label: LocalizedText;
}

// Условие показа: сейчас в файле встречается только «path_type равен …», поэтому
// правило проверяется через значение развилки, а не через ответы самого опроса.
export interface SurveyShowIf {
  questionId: string;
  equals: string;
}

export interface SurveyQuestion {
  id: string;
  // Путь в профиле (Приложение А §9), куда пишется ответ: "demographics.age", "goal.risk"…
  mapsTo: string;
  type: SurveyQuestionType;
  required: boolean;
  text: LocalizedText;
  options: SurveyOption[];
  input: { min?: number; max?: number; maxLen?: number };
  showIf: SurveyShowIf | null;
}

export interface SurveySection {
  id: string;
  title: LocalizedText;
  showIf: SurveyShowIf | null;
  questions: SurveyQuestion[];
}

interface RawOption {
  value: string;
  label_ru: string;
  label_uz: string;
}

interface RawShowIf {
  question_id: string;
  equals: string;
}

interface RawQuestion {
  id: string;
  maps_to: string;
  type: SurveyQuestionType;
  required: boolean;
  text_ru: string;
  text_uz: string;
  options?: RawOption[];
  input?: { min?: number; max?: number; max_len?: number };
  show_if?: RawShowIf;
}

interface RawSection {
  id: string;
  title_ru: string;
  title_uz: string;
  show_if?: RawShowIf;
  questions: RawQuestion[];
}

function toShowIf(raw: RawShowIf | undefined): SurveyShowIf | null {
  return raw ? { questionId: raw.question_id, equals: raw.equals } : null;
}

function toOptions(raw: RawOption[] | undefined): SurveyOption[] {
  return (raw ?? []).map((o) => ({ value: o.value, label: { ru: o.label_ru, uz: o.label_uz } }));
}

const survey = normalizeUzFields(surveyRaw) as { sections: RawSection[] };

// Все разделы опроса, кроме вопроса path_type (он приходит с экрана-развилки).
export const SURVEY_SECTIONS: SurveySection[] = survey.sections
  .map((s) => ({
    id: s.id,
    title: { ru: s.title_ru, uz: s.title_uz },
    showIf: toShowIf(s.show_if),
    questions: s.questions
      .filter((q) => q.id !== "path_type")
      .map((q) => ({
        id: q.id,
        mapsTo: q.maps_to,
        type: q.type,
        required: q.required,
        text: { ru: q.text_ru, uz: q.text_uz },
        options: toOptions(q.options),
        input: { min: q.input?.min, max: q.input?.max, maxLen: q.input?.max_len },
        showIf: toShowIf(q.show_if),
      })),
  }))
  .filter((s) => s.questions.length > 0);

// Быстрый доступ по id вопроса (для сборки профиля из ответов).
export const SURVEY_QUESTIONS: Record<string, SurveyQuestion> = Object.fromEntries(
  SURVEY_SECTIONS.flatMap((s) => s.questions).map((q) => [q.id, q]),
);

function showIfMatches(showIf: SurveyShowIf | null, pathType: PathType): boolean {
  if (!showIf) return true;
  // Единственное условие в файле — по path_type; для него значение берём с развилки.
  return showIf.questionId === "path_type" ? isPathType(showIf.equals) && showIf.equals === pathType : true;
}

// Разделы и вопросы, которые нужно показать для данного пути (knows_goal / no_goal).
export function surveySectionsFor(pathType: PathType): SurveySection[] {
  return SURVEY_SECTIONS.filter((s) => showIfMatches(s.showIf, pathType)).map((s) => ({
    ...s,
    questions: s.questions.filter((q) => showIfMatches(q.showIf, pathType)),
  }));
}

export function surveyQuestionsFor(pathType: PathType): SurveyQuestion[] {
  return surveySectionsFor(pathType).flatMap((s) => s.questions);
}
