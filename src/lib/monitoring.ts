import "server-only";
import { getDb } from "@/lib/db";

// Сбор ошибок сервера в одном месте (этап 10В). По умолчанию — ничего никуда не уходит: ошибка
// пишется в таблицу ErrorLog (её смотрит владелец на /admin/errors), это работает на любом хостинге
// и данные не покидают сервер сайта. Внешняя отправка (Sentry или совместимый сервис, например
// самостоятельно установленный GlitchTip) включается переменной SENTRY_DSN — если её нет, внешний
// сервис не используется вообще.
//
// В meta разрешено класть только простые, заведомо безопасные значения (id, коды ошибок, языки
// и т. п.). НИКОГДА не передавайте сюда ответы тестов, профиль, содержимое отчёта/тизера,
// системные промпты, пароли или коды восстановления — этот журнал открыт владельцу и (если задан
// SENTRY_DSN) уходит на сторонний сервис.
export type SafeMeta = Record<string, string | number | boolean | null | undefined>;

let sentryInitDone = false;
async function getSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  const Sentry = await import("@sentry/node");
  if (!sentryInitDone) {
    Sentry.init({ dsn, tracesSampleRate: 0 });
    sentryInitDone = true;
  }
  return Sentry;
}

// Защита на случай, если что-то из этого случайно попало в текст ошибки (например, Prisma или zod
// подставили в сообщение значение поля): вырезаем по имени поля, даже если сам вызывающий код
// meta не передавал. Это не замена дисциплине выше (не передавать чувствительное в logError),
// а вторая линия защиты — см. monitoring.test.ts.
const SENSITIVE_FIELD_NAMES = [
  "password",
  "recoveryCode",
  "recovery_code",
  "answers",
  "answerMap",
  "surveyAnswerMap",
  "profile",
  "scores",
  "content",
  "responseText",
  "systemTemplate",
  "userTemplate",
  "portrait",
  "goal",
  "main_path",
  "alternatives",
  "act_now",
];

const SCRUBBED = "[скрыто]";

export function scrubSensitiveText(text: string): string {
  let out = text;
  for (const field of SENSITIVE_FIELD_NAMES) {
    // JSON-подобно: "field": "значение" | [значение] | {значение} | значение,
    out = out.replace(
      new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|\\{[^{}]*\\}|\\[[^[\\]]*\\]|[^,}\\]]+)`, "gi"),
      `"${field}":"${SCRUBBED}"`,
    );
    // Просто field=значение или field: значение вне JSON — значением считаем всё до конца строки
    // (текст отчёта или профиля — это фраза, не одно слово).
    out = out.replace(new RegExp(`\\b${field}\\b\\s*[=:]\\s*.+`, "gi"), `${field}=${SCRUBBED}`);
  }
  return out;
}

function scrubMeta(meta: SafeMeta | undefined): SafeMeta | undefined {
  if (!meta) return meta;
  const out: SafeMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = typeof value === "string" ? scrubSensitiveText(value) : value;
  }
  return out;
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return scrubSensitiveText(raw);
}

function errorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return scrubSensitiveText(error.stack.slice(0, 4000));
  return null;
}

// scope — короткое место ("request", "auth", "payments", "ai-teaser", …), meta — только безопасные поля
// (см. список выше и комментарий к SafeMeta). Текст ошибки и meta дополнительно прогоняются через
// scrubSensitiveText — вторая линия защиты, если что-то чувствительное всё же оказалось в тексте.
export async function logError(scope: string, error: unknown, meta?: SafeMeta): Promise<void> {
  const safeMeta = scrubMeta(meta);
  console.error(`[error:${scope}]`, error, safeMeta ?? "");
  try {
    await getDb().errorLog.create({
      data: { scope, message: errorMessage(error).slice(0, 2000), stack: errorStack(error), meta: safeMeta ?? undefined },
    });
  } catch (e) {
    console.error("[monitoring] не получилось записать ErrorLog", e);
  }
  try {
    const Sentry = await getSentry();
    Sentry?.captureException(error, { tags: { scope }, extra: safeMeta });
  } catch (e) {
    console.error("[monitoring] не получилось отправить в Sentry", e);
  }
}
