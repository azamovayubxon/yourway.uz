import "server-only";
import type { Locale } from "@/i18n/config";
import { resolveReportModel, resolveTeaserModel } from "@/lib/admin/models";
import { GOLDEN_PROFILE, GOLDEN_PROFILE_NO_GOAL } from "./golden-profile";
import { MOCK_TEASERS } from "./mock-teasers";
import { isReportKey, validatePromptTemplates, type PromptKey } from "./prompt-registry";
import { getAiMode, getAiProvider, modelFor } from "./providers";
import { runReportPartAttempt } from "./report";
import { generateTeaser, type AttemptLog } from "./teaser";
import type { ReportLevel, ReportPathType } from "./prompts";

// Кнопка «Проверить» в /admin/prompts (этап 8б, требование 5): прогоняет черновик промпта на
// golden-профиле (Приложение Б §9) и возвращает, прошёл ли ответ проверку схемой. Ничего не
// сохраняется как отчёт пользователя — только результат для показа в админке. В мок-режиме
// (нет ANTHROPIC_API_KEY) отдаёт заглушку, как и обычная генерация.
//
// Для отчёта проверяется только первая часть (portrait_goal): она использует ровно тот же
// системный промпт, что и остальные части (он общий на весь отчёт, части различаются только
// пользовательским сообщением, PART_TASK_* — не редактируется здесь), и быстрее всего показывает,
// работает ли отредактированная роль/правила. Прогонять весь отчёт (3 вызова ИИ, минуты) ради
// проверки черновика было бы избыточно.

export interface PromptCheckResult {
  ok: boolean;
  content: unknown;
  error: string | null;
  problems: string[];
  responseText: string;
  aiMode: "mock" | "live";
  model: string;
}

function localeOf(key: PromptKey): Locale {
  return key.endsWith("_uz") ? "uz" : "ru";
}

export async function runPromptCheck(
  key: PromptKey,
  systemTemplate: string,
  userTemplate: string,
): Promise<PromptCheckResult> {
  const validationErrors = validatePromptTemplates(key, systemTemplate, userTemplate);
  const aiMode = getAiMode();
  if (validationErrors.length > 0) {
    return { ok: false, content: null, error: "validation", problems: validationErrors, responseText: "", aiMode, model: "" };
  }

  const locale = localeOf(key);
  const provider = getAiProvider(aiMode);
  const templates = { system: systemTemplate, user: userTemplate };

  if (isReportKey(key)) {
    const level: ReportLevel = key.includes("navigator") ? "navigator" : "route";
    const profile = level === "navigator" ? GOLDEN_PROFILE_NO_GOAL : GOLDEN_PROFILE;
    const pathType = profile.path_type as ReportPathType;
    const model = modelFor(aiMode, await resolveReportModel(level));
    const result = await runReportPartAttempt({
      part: "portrait_goal",
      profile,
      teaser: MOCK_TEASERS[locale],
      locale,
      level,
      pathType,
      previousParts: {},
      model,
      provider,
      templates,
    });
    return {
      ok: result.ok,
      content: result.content ?? null,
      error: result.error,
      problems: result.problems,
      responseText: result.responseText,
      aiMode,
      model,
    };
  }

  const model = modelFor(aiMode, await resolveTeaserModel(locale));
  const attempts: AttemptLog[] = [];
  const result = await generateTeaser({
    profile: GOLDEN_PROFILE,
    locale,
    model,
    provider,
    templates,
    onAttempt: (log) => {
      attempts.push(log);
    },
  });
  const last = attempts[attempts.length - 1];
  return {
    ok: result.ok,
    content: result.ok ? result.content : null,
    error: result.ok ? null : result.error,
    problems: last?.problems ?? [],
    responseText: last?.responseText ?? "",
    aiMode,
    model,
  };
}
