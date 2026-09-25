// Тесты воронки: вопросы, подписи шкалы и ключи подсчёта берутся из data/tests/*.json.
// Тексты не перепечатываются вручную. Узбекские апострофы исправляются при загрузке.
//
// Из файла Big Five берутся только вопросы и шкала ответов. Блоки `meta.usage_disclaimer`
// и `interpretation` (HR-тексты от версии на 120 пунктов) не используются (CLAUDE.md §4).

import bigFiveRaw from "../../../data/tests/ipip_neo_60_short.json";
import mappingRaw from "../../../data/tests/bigfive_to_16type_mapping.json";
import perceptionRaw from "../../../data/tests/perception_8.json";
import surveyRaw from "../../../data/tests/context_survey.json";
import riasecRaw from "../../../data/tests/riasec_30.json";
import valuesRaw from "../../../data/tests/values_12.json";
import type { Locale } from "@/i18n/config";
import { normalizeUzFields } from "./uzbek-text";

export const TEST_IDS = ["big_five", "riasec", "values", "perception"] as const;
export type TestId = (typeof TEST_IDS)[number];

export function isTestId(value: unknown): value is TestId {
  return typeof value === "string" && (TEST_IDS as readonly string[]).includes(value);
}

export type LocalizedText = Record<Locale, string>;

export interface TestQuestion {
  id: number;
  // Шкала, в которую идёт ответ: big_five → neuroticism…; riasec → R…; values → money…; perception → reading…
  scale: string;
  // Обратный пункт (только Big Five): балл = 6 − ответ.
  reverse: boolean;
  text: LocalizedText;
}

export interface TestDefinition {
  id: TestId;
  questions: TestQuestion[];
  // Подписи ответов 1–5 из `scoring.response_scale` файла.
  scaleLabels: { value: number; label: LocalizedText }[];
}

interface RawScaleItem {
  value: number;
  label_ru: string;
  label_uz: string;
}

function scaleLabels(items: RawScaleItem[]) {
  return items.map((s) => ({ value: s.value, label: { ru: s.label_ru, uz: s.label_uz } }));
}

// Имена шкал Big Five в файле с большой буквы ("Neuroticism"), в профиле — с маленькой.
const bigFive = normalizeUzFields(bigFiveRaw);
const riasec = normalizeUzFields(riasecRaw);
const values = normalizeUzFields(valuesRaw);
const perception = normalizeUzFields(perceptionRaw);

// Порядок в воронке (Приложение А §11): Big Five → RIASEC → Ценности → Восприятие.
export const TESTS: TestDefinition[] = [
  {
    id: "big_five",
    questions: bigFive.questions.map((q) => ({
      id: q.id,
      scale: q.factor.toLowerCase(),
      reverse: q.is_reverse,
      text: { ru: q.text_ru, uz: q.text_uz },
    })),
    scaleLabels: scaleLabels(bigFive.scoring.response_scale),
  },
  {
    id: "riasec",
    questions: riasec.questions.map((q) => ({
      id: q.id,
      scale: q.type,
      reverse: false,
      text: { ru: q.text_ru, uz: q.text_uz },
    })),
    scaleLabels: scaleLabels(riasec.scoring.response_scale),
  },
  {
    id: "values",
    questions: values.questions.map((q) => ({
      id: q.id,
      scale: q.value,
      reverse: false,
      text: { ru: q.text_ru, uz: q.text_uz },
    })),
    scaleLabels: scaleLabels(values.scoring.response_scale),
  },
  {
    id: "perception",
    questions: perception.questions.map((q) => ({
      id: q.id,
      scale: q.style,
      reverse: false,
      text: { ru: q.text_ru, uz: q.text_uz },
    })),
    scaleLabels: scaleLabels(perception.scoring.response_scale),
  },
];

export const TOTAL_QUESTIONS = TESTS.reduce((sum, t) => sum + t.questions.length, 0);

export function getTest(id: TestId): TestDefinition {
  return TESTS.find((t) => t.id === id)!;
}

export function isValidQuestion(testId: TestId, questionId: number): boolean {
  return getTest(testId).questions.some((q) => q.id === questionId);
}

// Порядок шкал для правил ничьих берётся из файлов (ключи `scoring.scales`):
// RIASEC: R→I→A→S→E→C; ценности: money→freedom→stability→recognition→helping→creativity;
// восприятие: reading→auditory→practice→repetition.
export const SCALE_ORDER = {
  riasec: Object.keys(riasec.scoring.scales),
  values: Object.keys(values.scoring.scales),
  perception: Object.keys(perception.scoring.scales),
};

// Названия 16 типов (RU и UZ) из mapping-файла.
const mapping = normalizeUzFields(mappingRaw);
export const SIXTEEN_TYPES: Record<string, LocalizedText> = Object.fromEntries(
  Object.entries(mapping.types).map(([code, t]) => [code, { ru: t.nickname_ru, uz: t.nickname_uz_lat }]),
);

// Экран-развилка: вопрос `path_type` и его варианты берутся из context_survey.json.
// В опросе (этап 3) этот вопрос пропускается, потому что уже задан здесь.
export const PATH_TYPES = ["knows_goal", "no_goal"] as const;
export type PathType = (typeof PATH_TYPES)[number];

export function isPathType(value: unknown): value is PathType {
  return typeof value === "string" && (PATH_TYPES as readonly string[]).includes(value);
}

interface RawSurveyQuestion {
  id: string;
  text_ru: string;
  text_uz: string;
  options?: { value: string; label_ru: string; label_uz: string }[];
}

const survey = normalizeUzFields(surveyRaw) as { sections: { questions: RawSurveyQuestion[] }[] };
const pathTypeQuestion = survey.sections.flatMap((s) => s.questions).find((q) => q.id === "path_type")!;

export const PATH_TYPE_QUESTION = {
  text: { ru: pathTypeQuestion.text_ru, uz: pathTypeQuestion.text_uz } as LocalizedText,
  options: (pathTypeQuestion.options ?? []).map((o) => ({
    value: o.value as PathType,
    label: { ru: o.label_ru, uz: o.label_uz } as LocalizedText,
  })),
};

// Названия шкал RIASEC, ценностей и стилей восприятия на двух языках (из файлов тестов).
function scaleNames(scales: Record<string, Record<string, unknown>>, ru: string, uz: string) {
  return Object.fromEntries(
    Object.entries(scales).map(([key, s]) => [key, { ru: String(s[ru]), uz: String(s[uz]) } as LocalizedText]),
  );
}

export const SCALE_NAMES = {
  riasec: scaleNames(riasec.scoring.scales, "type_ru", "type_uz"),
  values: scaleNames(values.scoring.scales, "value_ru", "value_uz"),
  perception: scaleNames(perception.scoring.scales, "style_ru", "style_uz"),
};
