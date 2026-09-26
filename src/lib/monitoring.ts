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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack.slice(0, 4000);
  return null;
}

// scope — короткое место ("request", "auth", "payments", "ai-teaser", …), meta — только безопасные поля.
export async function logError(scope: string, error: unknown, meta?: SafeMeta): Promise<void> {
  console.error(`[error:${scope}]`, error, meta ?? "");
  try {
    await getDb().errorLog.create({
      data: { scope, message: errorMessage(error).slice(0, 2000), stack: errorStack(error), meta: meta ?? undefined },
    });
  } catch (e) {
    console.error("[monitoring] не получилось записать ErrorLog", e);
  }
  try {
    const Sentry = await getSentry();
    Sentry?.captureException(error, { tags: { scope }, extra: meta });
  } catch (e) {
    console.error("[monitoring] не получилось отправить в Sentry", e);
  }
}
