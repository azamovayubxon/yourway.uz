// Настройки генерации из переменных окружения (см. .env.example). ID моделей в коде не хардкодим:
// значения ниже — только запасные, если переменная не задана. Всё, что зависит от поставщика ИИ
// (SDK, цены, режим), — в src/lib/ai/providers.

// Модель тизера зависит от языка: для узбекского — отдельная, более сильная модель (этап 4б),
// потому что дешёвая модель пишет по-узбекски как дословный перевод с русского.
export function teaserModel(locale: "ru" | "uz" = "ru"): string {
  if (locale === "uz") return process.env.MODEL_TEASER_UZ?.trim() || "claude-sonnet-5";
  return process.env.MODEL_TEASER?.trim() || "claude-haiku-4-5";
}

// Параметры вызова тизера (Приложение Б §1: temperature ~0.7, max_tokens ~1500).
// max_tokens с запасом: узбекский текст длиннее в токенах, а обрезанный JSON — это повтор и лишние деньги.
export const TEASER_TEMPERATURE = 0.7;
export const TEASER_MAX_TOKENS = 2500;
// Сколько раз повторять генерацию, если ответ ИИ не прошёл проверку (CLAUDE.md §7: до 2 повторов).
export const TEASER_MAX_RETRIES = 2;

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
