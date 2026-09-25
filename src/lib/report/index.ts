import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { resolveReportModel } from "@/lib/admin/models";
import { REPORT_PARTS, REPORT_PROMPT_VERSION, type ReportLevel, type ReportPathType } from "@/lib/ai/prompts";
import { createFailingProvider, getAiMode, getAiProvider, modelFor } from "@/lib/ai/providers";
import { runReportPartAttempt } from "@/lib/ai/report";
import { mergeReportParts, type ReportContent } from "@/lib/ai/report-schema";
import type { Profile } from "@/lib/assessment/profile";
import type { Locale } from "@/i18n/config";
import { decideNext, MAX_PART_ATTEMPTS, nextPart, partsDone, type ReportStatus } from "./progress";

// Полный отчёт: создание после оплаты и фоновая генерация по частям (Приложение Б §5а).
//
// Как идёт генерация. Страница отчёта раз в 3 секунды спрашивает POST /api/report/<id>. Если сейчас
// никто не генерирует, сервер берёт следующую часть (или повтор) и запускает ОДНУ попытку в фоне
// (after() из Next.js — работает и на Vercel, и на своём сервере), а сам сразу отвечает. Так каждая
// попытка — отдельный запрос и укладывается в лимит времени хостинга (maxDuration = 300 с).
// Если человек закрыл страницу, начатая часть допишется, а следующая начнётся, когда он откроет
// отчёт снова (из аккаунта). Оплаченный доступ при сбое не теряется: кнопка «Сгенерировать заново».

export type { ReportStatus } from "./progress";

export interface ReportState {
  status: "generating" | "ready" | "failed";
  done: number;
  total: number;
}

type Tx = Prisma.TransactionClient;

// Создаёт отчёт для оплаченного платежа (вызывается внутри транзакции оплаты).
// Профиль берётся на момент оплаты, уровень в нём заменяется выбранным (решение (В)).
// Тизер — на языке отчёта, если он есть, иначе на другом языке (он нужен для согласованности направлений).
export async function createReportInTx(
  tx: Tx,
  payment: { id: string; userId: string; sessionId: string; level: string; locale: string },
): Promise<string> {
  const session = await tx.testSession.findUniqueOrThrow({
    where: { id: payment.sessionId },
    select: { profile: true, pathType: true, teasers: { where: { status: "ready" }, orderBy: { createdAt: "asc" } } },
  });
  const profile = session.profile as unknown as Profile | null;
  if (!profile) throw new Error("report: профиль сессии не собран");
  const teaser = session.teasers.find((t) => t.locale === payment.locale) ?? session.teasers[0];
  if (!teaser?.content) throw new Error("report: нет готового тизера");

  const aiMode = getAiMode();
  const report = await tx.report.create({
    data: {
      userId: payment.userId,
      sessionId: payment.sessionId,
      paymentId: payment.id,
      level: payment.level,
      locale: payment.locale,
      pathType: session.pathType,
      status: "pending",
      profile: { ...profile, level: payment.level } as unknown as Prisma.InputJsonValue,
      teaser: teaser.content as Prisma.InputJsonValue,
      aiMode,
      model: modelFor(aiMode, await resolveReportModel(payment.level as ReportLevel)),
      promptVersion: REPORT_PROMPT_VERSION,
    },
    select: { id: true },
  });
  return report.id;
}

export async function getUserReport(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return getDb().report.findFirst({ where: { id, userId } });
}

export async function listUserReports(userId: string) {
  return getDb().report.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, level: true, locale: true, status: true, createdAt: true, sessionId: true },
  });
}

function toState(status: string, parts: Record<string, unknown>): ReportState {
  const s: ReportState["status"] = status === "ready" ? "ready" : status === "failed" ? "failed" : "generating";
  return { status: s, done: partsDone(parts), total: REPORT_PARTS.length };
}

export interface AdvanceResult {
  state: ReportState | null;
  // Фоновая работа (одна попытка одной части); её запускают через after() после ответа браузеру.
  job?: () => Promise<void>;
}

// Продвигает генерацию: сообщает статус и, если никто не генерирует, запускает следующую попытку.
// regenerate — «Сгенерировать заново» после сбоя (без повторной оплаты; готовые части сохраняются).
// simulateFailure — служебная имитация сбоя ИИ (/dev/ai-fail, только вне боевого сайта).
export async function advanceReport(options: {
  reportId: string;
  userId: string;
  regenerate?: boolean;
  simulateFailure?: boolean;
}): Promise<AdvanceResult> {
  const db = getDb();
  let report = await getUserReport(options.reportId, options.userId);
  if (!report) return { state: null };

  if (report.status === "failed" && options.regenerate) {
    const reset = await db.report.updateMany({
      where: { id: report.id, status: "failed" },
      data: { status: "generating", partAttempt: 0, retry: Prisma.DbNull, error: null, lockedAt: null },
    });
    if (reset.count > 0) report = (await getUserReport(report.id, options.userId))!;
  }

  const parts = (report.parts ?? {}) as Record<string, unknown>;
  const decision = decideNext({ ...report, parts }, new Date());
  if (decision === "done" || decision === "wait") return { state: toState(report.status, parts) };
  if (decision === "timeout") {
    await db.report.updateMany({
      where: { id: report.id, lockedAt: report.lockedAt },
      data: { status: "failed", error: "timeout", lockedAt: null, partAttempt: 0, retry: Prisma.DbNull },
    });
    return { state: toState("failed", parts) };
  }

  const part = nextPart(parts);
  if (!part) {
    // Все части есть, но отчёт не собран (сбой между записями) — собираем.
    await finalize(report.id, parts);
    return { state: toState("ready", parts) };
  }

  const aiMode = getAiMode();
  const level = report.level as ReportLevel;
  const model = modelFor(aiMode, await resolveReportModel(level));
  // «Захватываем» часть атомарно: две вкладки не запустят одну и ту же попытку дважды.
  // Номер попытки увеличиваем сразу — так зависшая попытка тоже считается (см. decideNext).
  const claimed = await db.report.updateMany({
    where: { id: report.id, updatedAt: report.updatedAt, status: { in: ["pending", "generating"] } },
    data: { status: "generating", lockedAt: new Date(), partAttempt: { increment: 1 }, aiMode, model },
  });
  if (claimed.count === 0) return { state: toState("generating", parts) };

  const attempt = report.partAttempt + 1;
  const retry = report.retry as { previousResponse: string; problems: string[] } | null;
  const provider = options.simulateFailure ? createFailingProvider() : getAiProvider(aiMode);
  const { id: reportId, sessionId, locale } = report;
  const profile = report.profile as unknown as Profile;
  const teaser = report.teaser;
  const pathType = report.pathType as ReportPathType;

  const job = async () => {
    try {
      const result = await runReportPartAttempt({
        part,
        profile,
        teaser,
        locale: locale as Locale,
        level,
        pathType,
        previousParts: parts,
        model,
        provider,
        retry: attempt > 1 && retry ? retry : undefined,
      });
      const costUsd = provider.estimateCostUsd(model, result.usage);
      // Короткая строка в логи сервера (видно в Vercel → Logs) + запись в журнал AiCall (/dev/ai-log).
      console.info(
        `[ai] report=${reportId} part=${part} provider=${provider.name} model=${model} locale=${locale}` +
          ` attempt=${attempt} ok=${result.ok} in=${result.usage.inputTokens} out=${result.usage.outputTokens}` +
          ` cache_read=${result.usage.cacheReadTokens} cache_write=${result.usage.cacheWriteTokens}` +
          ` cost=$${costUsd ?? "?"} ms=${result.durationMs}${result.error ? ` error=${result.error}` : ""}`,
      );
      await db.aiCall.create({
        data: {
          kind: "report",
          part,
          sessionId,
          reportId,
          aiMode,
          model,
          promptVersion: REPORT_PROMPT_VERSION,
          attempt,
          ok: result.ok,
          error: result.error,
          locale,
          problems: result.problems.length > 0 ? result.problems : Prisma.DbNull,
          responseText: result.responseText ? result.responseText.slice(0, 20_000) : null,
          ...result.usage,
          costUsd,
          durationMs: result.durationMs,
        },
      });

      if (result.ok) {
        const nextParts = { ...parts, [part]: result.content };
        await db.report.update({
          where: { id: reportId },
          data: {
            parts: nextParts as Prisma.InputJsonValue,
            partAttempt: 0,
            retry: Prisma.DbNull,
            lockedAt: null,
            attempts: { increment: 1 },
          },
        });
        if (!nextPart(nextParts)) await finalize(reportId, nextParts);
        return;
      }

      const canRetry = !result.fatal && attempt < MAX_PART_ATTEMPTS;
      await db.report.update({
        where: { id: reportId },
        data: canRetry
          ? {
              // Повтор с подсказкой: прошлый ответ и что в нём исправить. Если ответа не было
              // (сеть, таймаут) — повтор с чистого листа.
              retry: result.responseText.trim()
                ? { previousResponse: result.responseText, problems: result.problems }
                : Prisma.DbNull,
              lockedAt: null,
              attempts: { increment: 1 },
            }
          : {
              status: "failed",
              error: `${part}:${result.error ?? "unknown"}`.slice(0, 300),
              partAttempt: 0,
              retry: Prisma.DbNull,
              lockedAt: null,
              attempts: { increment: 1 },
            },
      });
    } catch (error) {
      // Неожиданный сбой (например, база недоступна): не оставляем отчёт «генерирующимся».
      console.error("[ai] report generation crashed", error);
      await db.report
        .update({ where: { id: reportId }, data: { status: "failed", error: "crash", lockedAt: null, partAttempt: 0 } })
        .catch(() => {});
    }
  };

  return { state: toState("generating", parts), job };
}

async function finalize(reportId: string, parts: Record<string, unknown>) {
  const content: ReportContent = mergeReportParts(parts as Parameters<typeof mergeReportParts>[0]);
  await getDb().report.update({
    where: { id: reportId },
    data: {
      status: "ready",
      content: content as unknown as Prisma.InputJsonValue,
      readyAt: new Date(),
      lockedAt: null,
      error: null,
    },
  });
}

export function reportStatusOf(status: string): ReportStatus {
  return (["pending", "generating", "ready", "failed"] as const).find((s) => s === status) ?? "pending";
}
