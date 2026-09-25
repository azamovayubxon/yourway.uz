import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { teaserLimits, teaserModel } from "@/lib/ai/config";
import { getAiMode, getAiProvider, modelFor } from "@/lib/ai/providers";
import { TEASER_PROMPT_VERSION } from "@/lib/ai/prompts";
import { generateTeaser } from "@/lib/ai/teaser";
import type { Profile } from "@/lib/assessment/profile";
import type { Locale } from "@/i18n/config";
import { checkTeaserLimits, type LimitReason } from "./limits";

// Тизер в статусе generating дольше этого времени считаем зависшим (процесс упал, сервер перезапустился)
// и разрешаем запустить генерацию заново. Больше, чем maxDuration у /api/teaser (120 с).
const STALE_GENERATING_MS = 150 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TeaserState =
  | { status: "ready" }
  | { status: "generating" }
  | { status: "failed" }
  | { status: "limit"; reason: LimitReason }
  | { status: "not_ready" };

// Хеш IP и IP из заголовков — общие для тизера и входа в аккаунт (src/lib/ip.ts).
export { clientIp, hashIp } from "@/lib/ip";

export async function getSessionTeasers(sessionId: string) {
  return getDb().teaser.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
}

function isStale(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() > STALE_GENERATING_MS;
}

// Можно ли в этой сессии получить тизер на языке locale (для кнопки «сделать на другом языке»).
// IP здесь не проверяем: это делается при самом запуске генерации.
export async function canGenerateInLocale(sessionId: string, locale: Locale): Promise<boolean> {
  const others = await getDb().teaser.count({
    where: { sessionId, locale: { not: locale }, status: { not: "failed" } },
  });
  return checkTeaserLimits({ otherLocaleTeasers: others, ipGenerationsLast24h: 0, limits: teaserLimits() }).ok;
}

// Статус тизера на языке locale — только чтение, ничего не запускает (для опроса со страницы).
// none — генерацию ещё не запускали (или она зависла): страница запускает её через POST.
export async function getTeaserStatus(
  sessionId: string,
  locale: Locale,
): Promise<"ready" | "generating" | "failed" | "none"> {
  const teaser = await getDb().teaser.findUnique({
    where: { sessionId_locale: { sessionId, locale } },
    select: { status: true, updatedAt: true },
  });
  if (!teaser) return "none";
  if (teaser.status === "generating") return isStale(teaser.updatedAt) ? "none" : "generating";
  return teaser.status === "ready" ? "ready" : "failed";
}

export interface TeaserRequestResult {
  state: TeaserState;
  // Фоновая работа: сама генерация. Её запускают ПОСЛЕ ответа браузеру (after() в /api/teaser),
  // поэтому запрос возвращается сразу, а страница опрашивает статус (решение «Фоновая генерация»).
  job?: () => Promise<void>;
}

// Запускает генерацию тизера (или сообщает, что он уже готов / генерируется / упёрся в лимит).
// Сама генерация не ждётся: она возвращается как job и выполняется в фоне.
export async function requestTeaser(options: {
  sessionId: string;
  status: string;
  profile: Profile | null;
  locale: Locale;
  ipHash: string | null;
}): Promise<TeaserRequestResult> {
  const state = (s: TeaserState): TeaserRequestResult => ({ state: s });
  const { sessionId, locale, ipHash } = options;
  const profile = options.profile;
  if (options.status !== "survey_done" || !profile) return state({ status: "not_ready" });

  const db = getDb();
  const existing = await db.teaser.findUnique({ where: { sessionId_locale: { sessionId, locale } } });
  if (existing?.status === "ready") return state({ status: "ready" });
  if (existing?.status === "generating" && !isStale(existing.updatedAt)) return state({ status: "generating" });

  const [otherLocaleTeasers, ipGenerationsLast24h] = await Promise.all([
    db.teaser.count({ where: { sessionId, locale: { not: locale }, status: { not: "failed" } } }),
    ipHash
      ? db.aiCall.count({
          where: { kind: "teaser", attempt: 1, ipHash, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
        })
      : Promise.resolve(0),
  ]);
  const decision = checkTeaserLimits({ otherLocaleTeasers, ipGenerationsLast24h, limits: teaserLimits() });
  if (!decision.ok) return state({ status: "limit", reason: decision.reason });

  const aiMode = getAiMode();
  const provider = getAiProvider(aiMode);
  const model = modelFor(aiMode, teaserModel(locale));
  const fields = {
    aiMode,
    model,
    promptVersion: TEASER_PROMPT_VERSION,
    level: profile.level,
    attempts: 0,
    error: null,
  };

  // «Захватываем» генерацию атомарно, чтобы две вкладки не запустили её одновременно.
  let teaserId: string;
  if (existing) {
    const claimed = await db.teaser.updateMany({
      where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
      data: { ...fields, status: "generating", content: Prisma.DbNull },
    });
    if (claimed.count === 0) return state({ status: "generating" });
    teaserId = existing.id;
  } else {
    try {
      teaserId = (await db.teaser.create({ data: { ...fields, sessionId, locale, status: "generating" } })).id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return state({ status: "generating" });
      }
      throw error;
    }
  }

  const job = async () => {
    let result: Awaited<ReturnType<typeof generateTeaser>>;
    try {
      result = await generateTeaser({
        profile,
        locale,
        model,
        provider,
        onAttempt: async (log) => {
          const costUsd = provider.estimateCostUsd(model, log.usage);
          // Короткая строка в логи сервера (видно в Vercel → Logs) + запись в журнал AiCall.
          console.info(
            `[ai] teaser provider=${provider.name} model=${model} locale=${locale} attempt=${log.attempt} ok=${log.ok}` +
              ` in=${log.usage.inputTokens} out=${log.usage.outputTokens}` +
              ` cache_read=${log.usage.cacheReadTokens} cache_write=${log.usage.cacheWriteTokens}` +
              ` cost=$${costUsd ?? "?"} ms=${log.durationMs}${log.error ? ` error=${log.error}` : ""}`,
          );
          await db.aiCall.create({
            data: {
              kind: "teaser",
              sessionId,
              teaserId,
              ipHash,
              aiMode,
              model,
              promptVersion: TEASER_PROMPT_VERSION,
              attempt: log.attempt,
              ok: log.ok,
              error: log.error,
              locale,
              problems: log.problems.length > 0 ? log.problems : Prisma.DbNull,
              responseText: log.responseText ? log.responseText.slice(0, 20_000) : null,
              ...log.usage,
              costUsd,
              durationMs: log.durationMs,
            },
          });
        },
      });
    } catch (error) {
      // Неожиданный сбой (например, база недоступна): не оставляем тизер «генерирующимся».
      console.error("[ai] teaser generation crashed", error);
      result = { ok: false, error: "crash", attempts: 0 };
    }

    await db.teaser.update({
      where: { id: teaserId },
      data: result.ok
        ? { status: "ready", content: result.content, attempts: result.attempts, error: null }
        : { status: "failed", attempts: result.attempts, error: result.error.slice(0, 300) },
    });
  };

  return { state: { status: "generating" }, job };
}
