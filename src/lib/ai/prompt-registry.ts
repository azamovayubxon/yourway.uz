// Реестр редактируемых промптов (этап 8б). Редактируемая часть — ровно то, что уже показывалось
// в /admin/prompts по отдельности как «Системный промпт» и «Пользовательское сообщение»: роль,
// жёсткие правила, схема вывода (у тизера — прямо в системном промпте; у отчёта схема и справочник
// баллов — фиксированный код, REPORT_SCHEMA/PROFILE_GUIDE, и не редактируются, чтобы модель отчёта
// не осталась без описания формата). Блок философии (PHILOSOPHY_BLOCK) и правила узбекского
// (UZ_RULES_TEMPLATE) — общая инфраструктура, тоже не редактируются здесь: они переиспользуются
// в обоих вызовах и проверяются отдельным автотестом на «вы/siz» и на соответствие документу.
//
// Разбивка ключей — «тизер/отчёт, уровни, ru/uz» (задача этапа 8б), т.е. крест из:
// - kind: teaser | report;
// - level: только для отчёта (route | navigator) — модель уже выбирается по уровню (ModelOverride),
//   промпт получает ту же гранулярность, чтобы владелец мог в будущем развести тексты по уровням;
// - locale: ru | uz — тексты реально разные (для uz добавляется блок правил на узбекском).

import type { Locale } from "@/i18n/config";
import {
  REPORT_SYSTEM_TEMPLATE,
  REPORT_USER_TEMPLATE,
  TEASER_SYSTEM_TEMPLATE,
  TEASER_USER_TEMPLATE,
  PHILOSOPHY_PLACEHOLDER,
  type ReportLevel,
} from "./prompts";

export type PromptKey =
  | "teaser_ru"
  | "teaser_uz"
  | "report_route_ru"
  | "report_route_uz"
  | "report_navigator_ru"
  | "report_navigator_uz";

export const PROMPT_KEYS: PromptKey[] = [
  "teaser_ru",
  "teaser_uz",
  "report_route_ru",
  "report_route_uz",
  "report_navigator_ru",
  "report_navigator_uz",
];

export const PROMPT_LABELS: Record<PromptKey, string> = {
  teaser_ru: "Тизер · русский язык",
  teaser_uz: "Тизер · узбекский язык",
  report_route_ru: "Полный отчёт · «Маршрут» · русский язык",
  report_route_uz: "Полный отчёт · «Маршрут» · узбекский язык",
  report_navigator_ru: "Полный отчёт · «Навигатор» · русский язык",
  report_navigator_uz: "Полный отчёт · «Навигатор» · узбекский язык",
};

export function promptKeyForTeaser(locale: Locale): PromptKey {
  return locale === "uz" ? "teaser_uz" : "teaser_ru";
}

export function promptKeyForReport(level: ReportLevel, locale: Locale): PromptKey {
  const localeSuffix = locale === "uz" ? "uz" : "ru";
  return level === "navigator" ? `report_navigator_${localeSuffix}` : `report_route_${localeSuffix}`;
}

export function isReportKey(key: PromptKey): boolean {
  return key.startsWith("report_");
}

interface FieldSpec {
  template: string;
  // Подстановки {{...}}, которые ДОЛЖНЫ быть в тексте — иначе модель молча недополучит важные данные.
  required: string[];
  // Все подстановки, которые допустимы. Любая другая {{...}} в тексте — опечатка: при генерации
  // fillTemplate не найдёт для неё значения и упадёт с ошибкой, поэтому такое сохранить нельзя.
  allowed: string[];
}

interface PromptDefault {
  system: FieldSpec;
  user: FieldSpec;
  // Названия полей JSON-схемы, которые обязаны остаться в системном промпте текстом (только у тизера:
  // схема вывода вписана прямо в TEASER_SYSTEM_TEMPLATE, а не вынесена в отдельный блок, как у отчёта).
  requiredSchemaFields?: string[];
}

const TEASER_DEFAULT: PromptDefault = {
  system: { template: TEASER_SYSTEM_TEMPLATE, required: ["language"], allowed: ["language"] },
  user: { template: TEASER_USER_TEMPLATE, required: ["profile_json"], allowed: ["profile_json"] },
  requiredSchemaFields: [
    "personality_type_label",
    "portrait",
    "top_strengths",
    "fitting_directions",
    "surprise_hook",
    "surprise_direction_internal",
    "locked_toc",
  ],
};

const REPORT_DEFAULT: PromptDefault = {
  system: { template: REPORT_SYSTEM_TEMPLATE, required: ["language"], allowed: ["language", "level", "path_type"] },
  user: {
    template: REPORT_USER_TEMPLATE,
    required: ["profile_json", "teaser_json", "level", "path_type", "language"],
    allowed: ["profile_json", "teaser_json", "level", "path_type", "language"],
  },
};

export const PROMPT_DEFAULTS: Record<PromptKey, PromptDefault> = {
  teaser_ru: TEASER_DEFAULT,
  teaser_uz: TEASER_DEFAULT,
  report_route_ru: REPORT_DEFAULT,
  report_route_uz: REPORT_DEFAULT,
  report_navigator_ru: REPORT_DEFAULT,
  report_navigator_uz: REPORT_DEFAULT,
};

function usedPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) found.add(match[1]);
  return [...found];
}

function checkField(label: string, text: string, spec: FieldSpec): string[] {
  const errors: string[] = [];
  const used = usedPlaceholders(text);
  for (const need of spec.required) {
    if (!used.includes(need)) errors.push(`В ${label} не хватает обязательной подстановки {{${need}}}.`);
  }
  for (const found of used) {
    if (!spec.allowed.includes(found)) {
      errors.push(`В ${label} есть неизвестная подстановка {{${found}}} — при генерации это приведёт к ошибке.`);
    }
  }
  return errors;
}

// Проверка перед сохранением (требование 4 этапа 8б): все обязательные подстановки на месте,
// иначе — понятная ошибка, а не сохранение сломанного промпта.
export function validatePromptTemplates(key: PromptKey, systemTemplate: string, userTemplate: string): string[] {
  const def = PROMPT_DEFAULTS[key];
  const errors = [
    ...checkField("системном промпте", systemTemplate, def.system),
    ...checkField("пользовательском сообщении", userTemplate, def.user),
  ];
  if (!systemTemplate.includes(PHILOSOPHY_PLACEHOLDER)) {
    errors.push(`В системном промпте должна остаться метка «${PHILOSOPHY_PLACEHOLDER}» — на её место подставляется блок философии продукта.`);
  }
  for (const field of def.requiredSchemaFields ?? []) {
    if (!systemTemplate.includes(field)) {
      errors.push(`В системном промпте пропало поле схемы вывода «${field}» — модель перестанет его возвращать.`);
    }
  }
  return errors;
}

// ───────────── Чистая логика версий (без БД — для тестов, prompt-store.ts вызывает через Prisma) ─────────────

export interface VersionLike {
  version: number;
  active: boolean;
}

// Активная версия из списка версий одного ключа (упорядочивание не важно — активна ровно одна).
// null — активной версии нет (ключ ещё не создавался или её сняли, не выбрав новую; prompt-store.ts
// в этом случае подставляет текст из кода).
export function pickActiveVersion<T extends VersionLike>(versions: T[]): T | null {
  return versions.find((v) => v.active) ?? null;
}

// Номер следующей версии при сохранении (версии никогда не удаляются и не переиспользуют номер).
export function nextVersionNumber(existing: { version: number }[]): number {
  return existing.reduce((max, v) => Math.max(max, v.version), 0) + 1;
}

// Метка для Teaser.promptVersion / Report.promptVersion / AiCall.promptVersion: "<key>:v<N>" для
// версии из БД, "code" — если действующей версии в БД ещё нет (только что созданный ключ до сеятеля).
export function promptVersionLabel(row: { key: string; version: number }): string {
  return row.version > 0 ? `${row.key}:v${row.version}` : "code";
}

// Обратный разбор: возвращает номер версии из метки, или null для "code" / неизвестного формата.
export function parsePromptVersionLabel(label: string): { version: number } | null {
  const match = /:v(\d+)$/.exec(label);
  return match ? { version: Number(match[1]) } : null;
}
