// Генерация тизера (Вызов 1, Приложение Б §4): промпт → ИИ → проверка схемой и правилами → повторы.
// Здесь нет базы данных: каждая попытка отдаётся наружу через onAttempt (там её пишут в журнал).

import type { Locale } from "@/i18n/config";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import { TEASER_MAX_RETRIES, TEASER_MAX_TOKENS, TEASER_TEMPERATURE } from "./config";
import { buildTeaserPrompt, type UzPromptResources } from "./prompts";
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
  error: string | null;
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

export async function generateTeaser(options: {
  profile: Profile;
  locale: Locale;
  model: string;
  provider: AiProvider;
  onAttempt?: (log: AttemptLog) => Promise<void> | void;
  // Глоссарий и эталоны для узбекского; по умолчанию читаются из docs/ (для тестов можно подменить).
  uz?: UzPromptResources;
}): Promise<TeaserResult> {
  const { locale, model, provider, onAttempt } = options;
  const uz = locale === "uz" ? (options.uz ?? { glossary: getUzGlossary(), examples: getUzExamples() }) : undefined;
  const prompt = buildTeaserPrompt(profileForLanguage(options.profile, locale), locale, uz);
  const maxAttempts = 1 + TEASER_MAX_RETRIES;
  let lastError = "unknown";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    let usage: TokenUsage = ZERO_USAGE;
    let result: { ok: true; content: TeaserContent } | { ok: false; error: string };
    let fatal = false;

    try {
      const response = await provider.call({
        model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: TEASER_MAX_TOKENS,
        temperature: TEASER_TEMPERATURE,
        outputSchema: TeaserOutputSchema,
      });
      usage = response.usage;
      if (response.finish !== "complete") {
        result = { ok: false, error: `finish:${response.finish}` };
      } else {
        const json = parseJsonOrNull(response.text);
        result =
          json === null
            ? { ok: false, error: "json:invalid" }
            : validateTeaser(locale === "uz" ? normalizeUzTeaser(json) : json, locale, uz?.glossary);
      }
    } catch (error) {
      fatal = error instanceof AiFatalError;
      result = { ok: false, error: `api:${error instanceof Error ? error.message.slice(0, 200) : "error"}` };
    }

    await onAttempt?.({
      attempt,
      ok: result.ok,
      error: result.ok ? null : result.error,
      usage,
      durationMs: Date.now() - started,
    });

    if (result.ok) return { ok: true, content: result.content, attempts: attempt };
    lastError = result.error;
    if (fatal) return { ok: false, error: lastError, attempts: attempt };
  }
  return { ok: false, error: lastError, attempts: maxAttempts };
}
