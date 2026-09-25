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

// ───────────── Полный отчёт (этап 6) ─────────────

// Модель полного отчёта по уровню (CLAUDE.md §3): «Маршрут» — MODEL_ROUTE, «Навигатор» — MODEL_NAVIGATOR.
export function reportModel(level: "route" | "navigator"): string {
  if (level === "navigator") return process.env.MODEL_NAVIGATOR?.trim() || "claude-opus-5-5";
  return process.env.MODEL_ROUTE?.trim() || "claude-sonnet-5";
}

// Сколько секунд хостинг даёт одному запросу генерации части отчёта (maxDuration у /api/report).
// 300 с — максимум тарифа Vercel Hobby (и значение по умолчанию на Pro) с Fluid compute;
// на своём сервере с `next start` лимита нет. Одна попытка одной части должна уложиться в это время.
export const REPORT_MAX_DURATION_SEC = 300;
// Лимит на одну попытку, мс: с запасом на запись в базу после ответа ИИ.
export const REPORT_ATTEMPT_TIMEOUT_MS = 270_000;
// Часть в работе дольше этого времени считаем зависшей (процесс упал, сервер перезапустился)
// и разрешаем взять её заново.
export const REPORT_STALE_LOCK_MS = (REPORT_MAX_DURATION_SEC + 30) * 1000;
// Повторов на одну часть, если ответ не прошёл проверку (как у тизера, решение (Р)): 1, и в нём ИИ
// получает свой прошлый ответ и список того, что исправить. Дальше — кнопка «Сгенерировать заново».
export const REPORT_MAX_RETRIES = 1;

export interface ReportSettings {
  // Приложение Б §1: ~0.6 для отчёта. Передаётся только моделям, которые её принимают.
  temperature: number;
  // Глубина размышлений: medium — баланс качества платного отчёта и скорости (у Opus 5.5 это
  // и так значение по умолчанию; у Sonnet 5 по умолчанию high — это дольше и дороже).
  effort: "low" | "medium" | "high";
  // Лимит длины ответа на каждую часть, токенов (включая размышления). С запасом: узбекский текст
  // «весит» в токенах в 2–3 раза больше русского. Обрезанный ответ = брак и повтор.
  maxTokens: Record<"portrait_goal" | "main_path" | "finish", number>;
  attemptTimeoutMs: number;
  // TTL записи кэша системного промпта (этап 7, разбор /dev/ai-log: у «Навигатора» на Opus
  // cache_read_input_tokens был 0, у «Маршрута» на Sonnet — нет). Причина не в модели и не в длине
  // промпта (минимум для кэша у Opus даже ниже, чем у Sonnet), а в тайминге: части отчёта генерируются
  // по одной, следующая попытка начинается только после того, как человек снова откроет страницу
  // (опрос раз в 3 с) и увидит, что предыдущая часть готова. У «Навигатора» дольше сама генерация
  // (effort medium на Opus, maxTokens больше — до attemptTimeoutMs = 270 с) — часть этого времени
  // «съедает» 5-минутный TTL записи, и к началу следующей части кэш чаще успевает истечь. Поэтому
  // для «Навигатора» — TTL 1 час (дороже на запись в 2×, но при 3 частях + возможных повторах
  // окупается уже двумя чтениями). «Маршруту» она не нужна: там кэш и так успевает сработать
  // на 5-минутном TTL, а 1 час обошёлся бы дороже.
  cacheTtl?: "1h";
}

export function reportSettings(level: "route" | "navigator"): ReportSettings {
  // «Навигатор» пишет глубже и длиннее (Приложение Б §5: ~15–20 страниц против ~10–15).
  const extra = level === "navigator" ? 4000 : 0;
  return {
    temperature: 0.6,
    effort: "medium",
    maxTokens: { portrait_goal: 10_000 + extra, main_path: 14_000 + extra, finish: 10_000 + extra },
    attemptTimeoutMs: REPORT_ATTEMPT_TIMEOUT_MS,
    cacheTtl: level === "navigator" ? "1h" : undefined,
  };
}
