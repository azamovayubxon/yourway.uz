// Генерация тизера (Вызов 1, Приложение Б §4): промпт → ИИ → проверка схемой и правилами → 1 повтор
// с подсказкой, что исправить (этап 4б). Всё укладывается в TEASER_TIME_BUDGET_MS.
// Здесь нет базы данных: каждая попытка отдаётся наружу через onAttempt (там её пишут в журнал).

import type { Locale } from "@/i18n/config";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import {
  TEASER_ATTEMPT_TIMEOUT_MS,
  TEASER_EFFORT,
  TEASER_MAX_RETRIES,
  TEASER_MAX_TOKENS,
  TEASER_MIN_RETRY_MS,
  TEASER_TEMPERATURE,
  TEASER_TIME_BUDGET_MS,
} from "./config";
import { buildRetryFeedback, buildTeaserPrompt, type UzPromptResources } from "./prompts";
import { AiFatalError, ZERO_USAGE, type AiProvider, type TokenUsage } from "./providers";
import { extractJson, TeaserOutputSchema, validateTeaser, type TeaserContent } from "./teaser-schema";
import { getUzExamples, getUzGlossary, normalizeUz, uzSixteenTypeName } from "./uz-resources";

// Профиль для ИИ на нужном языке. Язык генерации = язык интерфейса (CLAUDE.md §7), поэтому
// language и название 16-типа берутся для выбранного языка, а не для языка, на котором шёл опрос.
// Узбекское название 16-типа — из глоссария docs/uz-glossary.md (этап 4б).
export function profileForLanguage(profile: Profile, locale: Locale): Profile {
  const code = profile.sixteen_type.code;
  const nickname =
    (locale === "uz" ? uzSixteenTypeName(code) : undefined) ??
    SIXTEEN_TYPES[code]?.[locale] ??
    profile.sixteen_type.nickname;
  return { ...profile, language: locale, sixteen_type: { ...profile.sixteen_type, nickname } };
}

// Узбекский текст от ИИ: разные виды апострофов (‘ ’ ` ') приводим к oʻ gʻ и ʼ (решение (Б)).
export function normalizeUzTeaser(content: unknown): unknown {
  const unify = (value: unknown): unknown => {
    if (typeof value === "string") return normalizeUz(value);
    if (Array.isArray(value)) return value.map(unify);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unify(v)]));
    }
    return value;
  };
  return unify(content);
}

export interface AttemptLog {
  attempt: number;
  ok: boolean;
  // Короткий код первой проблемы (null, если ответ принят).
  error: string | null;
  // Все проблемы понятным текстом (пусто, если ответ принят) — для /dev/ai-log.
  problems: string[];
  // Сырой текст ответа модели (пусто, если ответа не было: сбой сети, таймаут).
  responseText: string;
  usage: TokenUsage;
  durationMs: number;
}

export type TeaserResult =
  | { ok: true; content: TeaserContent; attempts: number }
  | { ok: false; error: string; attempts: number };

function parseJsonOrNull(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

type AttemptOutcome =
  | { ok: true; content: TeaserContent }
  | { ok: false; error: string; problems: string[] };

export async function generateTeaser(options: {
  profile: Profile;
  locale: Locale;
  model: string;
  provider: AiProvider;
  onAttempt?: (log: AttemptLog) => Promise<void> | void;
  // Глоссарий и эталоны для узбекского; по умолчанию читаются из docs/ (для тестов можно подменить).
  uz?: UzPromptResources;
  // Время на всю генерацию и на одну попытку, мс (для тестов можно подменить).
  timeBudgetMs?: number;
  now?: () => number;
}): Promise<TeaserResult> {
  const { locale, model, provider, onAttempt } = options;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeBudgetMs ?? TEASER_TIME_BUDGET_MS);
  const uz = locale === "uz" ? (options.uz ?? { glossary: getUzGlossary(), examples: getUzExamples() }) : undefined;
  const prompt = buildTeaserPrompt(profileForLanguage(options.profile, locale), locale, uz);
  const maxAttempts = 1 + TEASER_MAX_RETRIES;
  let lastError = "unknown";
  // Прошлый ответ и что в нём исправить — для повторной попытки (решение этапа 4б).
  let retry: { previousResponse: string; feedback: string } | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = deadline - now();
    // Повтор запускаем, только если на него хватает времени: иначе хостинг оборвёт генерацию на полуслове.
    if (attempt > 1 && remaining < TEASER_MIN_RETRY_MS) {
      lastError = `${lastError};no_time_for_retry`;
      return { ok: false, error: lastError, attempts: attempt - 1 };
    }
    const started = now();
    let usage: TokenUsage = ZERO_USAGE;
    let responseText = "";
    let outcome: AttemptOutcome;
    let fatal = false;

    try {
      const response = await provider.call({
        model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: TEASER_MAX_TOKENS,
        temperature: TEASER_TEMPERATURE,
        effort: TEASER_EFFORT,
        timeoutMs: Math.min(TEASER_ATTEMPT_TIMEOUT_MS, remaining),
        outputSchema: TeaserOutputSchema,
        tag: "teaser",
        retry,
      });
      usage = response.usage;
      responseText = response.text;
      if (response.finish === "truncated") {
        outcome = {
          ok: false,
          error: "finish:truncated",
          problems: ["ответ оборвался: не хватило длины — пишите короче, без лишних слов"],
        };
      } else if (response.finish === "refused") {
        outcome = { ok: false, error: "finish:refused", problems: ["модель отказалась отвечать"] };
      } else {
        const json = parseJsonOrNull(response.text);
        outcome =
          json === null
            ? { ok: false, error: "json:invalid", problems: ["ответ не является валидным JSON"] }
            : validateTeaser(locale === "uz" ? normalizeUzTeaser(json) : json, locale, uz?.glossary);
      }
    } catch (error) {
      fatal = error instanceof AiFatalError;
      const message = error instanceof Error ? error.message.slice(0, 200) : "error";
      outcome = { ok: false, error: `api:${message}`, problems: [`ошибка обращения к ИИ: ${message}`] };
    }

    await onAttempt?.({
      attempt,
      ok: outcome.ok,
      error: outcome.ok ? null : outcome.error,
      problems: outcome.ok ? [] : outcome.problems,
      responseText,
      usage,
      durationMs: now() - started,
    });

    if (outcome.ok) return { ok: true, content: outcome.content, attempts: attempt };
    lastError = outcome.error;
    if (fatal) return { ok: false, error: lastError, attempts: attempt };
    // Если модель что-то ответила, при повторе покажем ей этот ответ и список проблем.
    // Если ответа не было (сеть, таймаут), повтор идёт с чистого листа.
    retry = responseText.trim()
      ? { previousResponse: responseText, feedback: buildRetryFeedback(outcome.problems) }
      : undefined;
  }
  return { ok: false, error: lastError, attempts: maxAttempts };
}
