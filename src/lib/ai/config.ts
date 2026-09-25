// Настройки генерации из переменных окружения (см. .env.example). ID моделей в коде не хардкодим:
// значения ниже — только запасные, если переменная не задана. Всё, что зависит от поставщика ИИ
// (SDK, цены, режим), — в src/lib/ai/providers.

// Модель тизера зависит от языка: для узбекского — отдельная, более сильная модель (этап 4б),
// потому что дешёвая модель пишет по-узбекски как дословный перевод с русского.
export function teaserModel(locale: "ru" | "uz" = "ru"): string {
  if (locale === "uz") return process.env.MODEL_TEASER_UZ?.trim() || "claude-sonnet-5";
  return process.env.MODEL_TEASER?.trim() || "claude-haiku-4-5";
}

// Параметры вызова тизера (Приложение Б §1: temperature ~0.7). temperature принимают только старые
// модели (Haiku); новым (Sonnet 5) вместо неё задаётся effort — насколько глубоко «думать».
export const TEASER_TEMPERATURE = 0.7;
// low: тизер — короткий текст, глубокие размышления тут дают только задержку (у Sonnet 5 по умолчанию
// high, и одна попытка шла десятки секунд). Качество языка держат правила, глоссарий и эталоны.
export const TEASER_EFFORT = "low" as const;
// Лимит длины ответа, токенов. С большим запасом: узбекский текст «весит» в токенах в 2–3 раза больше
// русского, и у моделей с размышлениями они тоже входят в лимит. Обрезанный ответ = брак и повтор,
// а платим мы только за реально написанные токены.
export const TEASER_MAX_TOKENS = 8000;
// Сколько раз повторять генерацию, если ответ не прошёл проверку. Решение владельца (этап 4б):
// не больше 1 повтора, и в нём ИИ получает свой прошлый ответ и список того, что исправить.
export const TEASER_MAX_RETRIES = 1;
// Время на всю генерацию тизера (обе попытки), мс. Генерация идёт в фоне, но хостинг ограничивает
// время работы функции (maxDuration = 120 с у /api/teaser), поэтому держим запас.
export const TEASER_TIME_BUDGET_MS = 100_000;
// Лимит на одну попытку, мс. Повтор запускаем, только если на него осталось хотя бы MIN_RETRY_MS.
export const TEASER_ATTEMPT_TIMEOUT_MS = 60_000;
export const TEASER_MIN_RETRY_MS = 20_000;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

// Лимиты тизера (решение (К)). Числа — в переменных окружения, здесь только значения по умолчанию.
export interface TeaserLimits {
  perSession: number;
  langRegenPerSession: number;
  perIpPerDay: number;
}

export function teaserLimits(): TeaserLimits {
  return {
    perSession: intFromEnv("TEASER_LIMIT_PER_SESSION", 1),
    langRegenPerSession: intFromEnv("TEASER_LANG_REGEN_PER_SESSION", 1),
    perIpPerDay: intFromEnv("TEASER_LIMIT_PER_IP_PER_DAY", 30),
  };
}
