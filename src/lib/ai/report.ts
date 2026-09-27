// Полный отчёт (Вызов 2, Приложение Б §5–§7, §5а): одна попытка одной части отчёта.
// Промпт → ИИ → проверка схемой и правилами. Без базы данных и без повторов внутри: повтор
// (с прошлым ответом и списком проблем) запускается отдельным запросом к серверу — так ни один
// запрос не длится дольше одной попытки и укладывается в лимит времени хостинга.

import type { Locale } from "@/i18n/config";
import type { Profile } from "@/lib/assessment/profile";
import { reportSettings } from "./config";
import {
  buildReportPartPrompt,
  buildReportRetryFeedback,
  type ReportLevel,
  type ReportPartId,
  type ReportPathType,
  type UzPromptResources,
} from "./prompts";
import { AiFatalError, ZERO_USAGE, type AiProvider, type TokenUsage } from "./providers";
import { REPORT_PART_OUTPUT_SCHEMAS, validateReportPart } from "./report-schema";
import { extractJson } from "./teaser-schema";
import { normalizeUzTeaser, profileForLanguage } from "./teaser";
import { getUzExamples, getUzGlossary } from "./uz-resources";

export interface PartAttemptResult {
  ok: boolean;
  // Проверенное содержимое части. Есть и при ok:false, если схема разобралась, но не прошли
  // проверки тона/содержания (softOnly) — вызывающий код (report/index.ts) может принять этот
  // контент на последней попытке вместо провала генерации (решение владельца, этап C1).
  content?: unknown;
  // Короткий код первой проблемы и все проблемы текстом (для журнала и для подсказки при повторе).
  error: string | null;
  problems: string[];
  // Сырой текст ответа модели (пусто, если ответа не было: сбой сети, таймаут).
  responseText: string;
  usage: TokenUsage;
  durationMs: number;
  // Ошибка, после которой повторять бессмысленно (неверный ключ, неизвестная модель).
  fatal: boolean;
  // Все найденные нарушения (если есть) — «мягкие»: тон и содержание, не разрыв схемы или языка
  // (см. isSoftIssueCode в report-schema.ts). false, если ok:true или ответа не было вовсе.
  softOnly: boolean;
}

export async function runReportPartAttempt(options: {
  part: ReportPartId;
  profile: Profile;
  teaser: unknown;
  locale: Locale;
  level: ReportLevel;
  pathType: ReportPathType;
  previousParts: Record<string, unknown>;
  model: string;
  provider: AiProvider;
  // Повтор: прошлый ответ модели и что в нём не прошло проверку.
  retry?: { previousResponse: string; problems: string[] };
  uz?: UzPromptResources;
  now?: () => number;
  // Версия промпта из БД (этап 8б); по умолчанию — текст из кода (REPORT_SYSTEM/USER_TEMPLATE).
  templates?: { system: string; user: string };
}): Promise<PartAttemptResult> {
  const { part, locale, level, pathType, provider, model } = options;
  const now = options.now ?? Date.now;
  // UX-18: без своей цели человек выбрал «Маршрут» и указал цель на checkout — goal.statement уже
  // в профиле. pathRule (prompts.ts) просит ИИ оформить её как "stated"; проверка ниже должна
  // ожидать то же самое, а не требовать constructed_options, как для обычного no_goal.
  const statedGoal = pathType === "no_goal" && level === "route" && Boolean(options.profile.goal?.statement);
  const settings = reportSettings(level);
  const uz = locale === "uz" ? (options.uz ?? { glossary: getUzGlossary(), examples: getUzExamples() }) : undefined;
  const prompt = buildReportPartPrompt({
    profile: { ...profileForLanguage(options.profile, locale), level },
    teaser: options.teaser,
    language: locale,
    level,
    pathType,
    part,
    previousParts: options.previousParts,
    uz,
    templates: options.templates,
  });

  const started = now();
  let usage: TokenUsage = ZERO_USAGE;
  let responseText = "";
  try {
    const response = await provider.call({
      model,
      system: prompt.system,
      user: prompt.user,
      maxTokens: settings.maxTokens[part],
      temperature: settings.temperature,
      effort: settings.effort,
      timeoutMs: settings.attemptTimeoutMs,
      cacheTtl: settings.cacheTtl,
      outputSchema: REPORT_PART_OUTPUT_SCHEMAS[part],
      // Мок-режим должен пройти и этот путь (CLAUDE.md §3: воронка проходится без ключа) — при
      // statedGoal просим образец «stated», как и для обычного knows_goal (см. providers/mock.ts).
      tag: `report:${part}:${statedGoal ? "knows_goal" : pathType}`,
      retry: options.retry
        ? {
            previousResponse: options.retry.previousResponse,
            feedback: buildReportRetryFeedback(options.retry.problems),
          }
        : undefined,
    });
    usage = response.usage;
    responseText = response.text;
    const base = { responseText, usage, durationMs: now() - started, fatal: false };
    if (response.finish === "truncated") {
      return {
        ...base,
        ok: false,
        error: "finish:truncated",
        problems: ["ответ оборвался: не хватило длины — пишите плотнее, без повторов и общих фраз"],
        softOnly: false,
      };
    }
    if (response.finish === "refused") {
      return { ...base, ok: false, error: "finish:refused", problems: ["модель отказалась отвечать"], softOnly: false };
    }
    let json: unknown;
    try {
      json = extractJson(response.text);
    } catch {
      return { ...base, ok: false, error: "json:invalid", problems: ["ответ не является валидным JSON"], softOnly: false };
    }
    const checked = validateReportPart(part, locale === "uz" ? normalizeUzTeaser(json) : json, {
      language: locale,
      pathType: statedGoal ? "knows_goal" : pathType,
      level,
      uzRules: uz?.glossary,
    });
    return checked.ok
      ? { ...base, ok: true, content: checked.content, error: null, problems: [], softOnly: false }
      : { ...base, ok: false, error: checked.error, problems: checked.problems, content: checked.content, softOnly: checked.softOnly };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "error";
    return {
      ok: false,
      error: `api:${message}`,
      problems: [`ошибка обращения к ИИ: ${message}`],
      responseText,
      usage,
      softOnly: false,
      durationMs: now() - started,
      fatal: error instanceof AiFatalError,
    };
  }
}
