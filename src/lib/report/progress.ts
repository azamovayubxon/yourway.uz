// Логика фоновой генерации полного отчёта по частям — без базы данных (покрыта тестами).
// Сама работа с базой — в index.ts.

import { REPORT_MAX_RETRIES, REPORT_STALE_LOCK_MS } from "@/lib/ai/config";
import { REPORT_PARTS, type ReportPartId } from "@/lib/ai/prompts";

export type ReportStatus = "pending" | "generating" | "ready" | "failed";

export interface ReportRowState {
  status: string;
  parts: Record<string, unknown>;
  partAttempt: number;
  lockedAt: Date | null;
}

// Сколько попыток даётся одной части: первая + повторы.
export const MAX_PART_ATTEMPTS = 1 + REPORT_MAX_RETRIES;

// Первая ещё не готовая часть (null — все части готовы).
export function nextPart(parts: Record<string, unknown>): ReportPartId | null {
  return REPORT_PARTS.find((p) => !(p in parts)) ?? null;
}

export function partsDone(parts: Record<string, unknown>): number {
  return REPORT_PARTS.filter((p) => p in parts).length;
}

// Принять последнюю попытку части как есть вместо провала генерации (решение владельца, этап C1):
// оплативший пользователь не должен получить ошибку из-за слова «уникальный» или повторившегося
// пункта списка. Работает только когда (а) попыток больше не осталось, (б) сбой не фатальный
// (не «неверный ключ» и т. п.), (в) схема всё же разобралась (есть content — иначе принимать
// нечего) и (г) все найденные нарушения — «мягкие» (softOnly, см. isSoftIssueCode в
// report-schema.ts): тон и содержание, а не разрыв схемы, обязательных полей по типу пути,
// узбекского стиля или обращения на «ты».
export function shouldAcceptDespiteWarnings(
  attempt: number,
  result: { ok: boolean; fatal: boolean; softOnly: boolean; content?: unknown },
): boolean {
  if (result.ok || result.fatal || !result.softOnly) return false;
  if (result.content === undefined) return false;
  return attempt >= MAX_PART_ATTEMPTS;
}

// Что делать, когда страница отчёта спрашивает статус (раз в 3 секунды):
//   wait    — часть сейчас генерируется, ждём;
//   start   — никто не генерирует: взять следующую часть (или повтор текущей);
//   timeout — прошлая попытка зависла (сервер оборвал запрос), а попыток на эту часть больше нет;
//   done    — готово или не удалось (ничего не запускаем).
export function decideNext(row: ReportRowState, now: Date): "wait" | "start" | "timeout" | "done" {
  if (row.status === "ready" || row.status === "failed") return "done";
  if (row.lockedAt) {
    const stale = now.getTime() - row.lockedAt.getTime() > REPORT_STALE_LOCK_MS;
    if (!stale) return "wait";
    // Зависшая попытка уже посчитана (partAttempt увеличивается при старте): если она была
    // последней, дальше не крутим — иначе при слишком коротком лимите хостинга генерация
    // повторялась бы бесконечно и тратила деньги.
    if (row.partAttempt >= MAX_PART_ATTEMPTS) return "timeout";
  }
  return "start";
}
