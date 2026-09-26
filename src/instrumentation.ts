import type { Instrumentation } from "next";

// Ошибки, до которых не добрался свой try/catch (сбой в рендере страницы, необработанное
// исключение в API-роуте), тоже попадают в общий журнал (этап 10В, см. src/lib/monitoring.ts).
// Из запроса берём только путь и метод — ничего личного (ни cookie, ни тело запроса).
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  const { logError } = await import("@/lib/monitoring");
  await logError("request", error, { path: request.path, method: request.method });
};
