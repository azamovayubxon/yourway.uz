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
  // Проверенное содержимое части (если ok).
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
      tag: `report:${part}:${pathType}`,
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
      };
    }
    if (response.finish === "refused") {
      return { ...base, ok: false, error: "finish:refused", problems: ["модель отказалась отвечать"] };
    }
    let json: unknown;
    try {
      json = extractJson(response.text);
    } catch {
      return { ...base, ok: false, error: "json:invalid", problems: ["ответ не является валидным JSON"] };
    }
    const checked = validateReportPart(part, locale === "uz" ? normalizeUzTeaser(json) : json, {
      language: locale,
      pathType,
      level,
      uzRules: uz?.glossary,
    });
    return checked.ok
      ? { ...base, ok: true, content: checked.content, error: null, problems: [] }
      : { ...base, ok: false, error: checked.error, problems: checked.problems };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "error";
    return {
      ok: false,
      error: `api:${message}`,
      problems: [`ошибка обращения к ИИ: ${message}`],
      responseText,
      usage,
      durationMs: now() - started,
      fatal: error instanceof AiFatalError,
    };
  }
}
