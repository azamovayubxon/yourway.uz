import "server-only";
import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { modelSaveError } from "@/lib/admin/models";
import { REPORT_STALE_LOCK_MS } from "@/lib/ai/config";
import { GOLDEN_PROFILE, GOLDEN_PROFILE_NO_GOAL } from "@/lib/ai/golden-profile";
import { MOCK_TEASERS } from "@/lib/ai/mock-teasers";
import { promptKeyForReport, promptKeyForTeaser, type PromptKey } from "@/lib/ai/prompt-registry";
import { getActivePromptVersion, getPromptVersionByNumber, parsePromptVersionLabel, promptVersionLabel } from "@/lib/ai/prompt-store";
import { REPORT_PARTS, type ReportLevel, type ReportPathType } from "@/lib/ai/prompts";
import { getAiMode, getAiProvider, hasOpenAiKey, mockReportPart, modelFor, type TokenUsage } from "@/lib/ai/providers";
import { runReportPartAttempt } from "@/lib/ai/report";
import { generateTeaser } from "@/lib/ai/teaser";
import type { Profile } from "@/lib/assessment/profile";
import { MAX_PART_ATTEMPTS, shouldAcceptDespiteWarnings } from "@/lib/report/progress";
import { checkAndHitRateLimit } from "@/lib/rate-limit";
import {
  DEFAULT_TOKEN_GUESS,
  type CompareKind,
  type ComparePart,
  type CompareProfileSource,
  type CompareVerdict,
  type TokenGuess,
} from "./logic";

// Слепое сравнение моделей (/admin/compare, только superadmin).
//
// Обе генерации идут ровно тем путём, что и на боевом сайте: активная версия промпта из БД,
// правила узбекского, проверка схемой, content-checks и uz-style, повтор с подсказкой. Отличия:
//   - ничего не пишется в Teaser/Report и не считается в лимиты тизера по IP;
//   - нет страховки на Claude — сравнение должно показать, как пишет именно выбранная модель;
//   - вызовы идут в журнал AiCall с kind = "compare".
//
// Как и отчёт, генерация идёт по шагам: страница раз в 3 секунды спрашивает POST
// /api/admin/compare/<id>, и каждый запрос запускает в фоне (after()) не больше ОДНОЙ попытки
// одного варианта — так ни один запрос не выходит за лимит времени хостинга (часть отчёта — до 270 с).

// Сколько сравнений в час может запустить один суперадмин — защита бюджета на случай
// скомпрометированного аккаунта или случайных повторных нажатий.
const COMPARE_LIMIT_PER_HOUR = 20;
const LOCALE = "uz" as const;

export type StartResult = { ok: true; id: string } | { ok: false; error: StartError };
export type StartError = "bad_input" | "session_not_found" | "openai_key" | "bad_name" | "rate_limit";

function levelOf(kind: CompareKind): ReportLevel | null {
  return kind === "report_route" ? "route" : kind === "report_navigator" ? "navigator" : null;
}

function promptKeyOf(kind: CompareKind): PromptKey {
  const level = levelOf(kind);
  return level ? promptKeyForReport(level, LOCALE) : promptKeyForTeaser(LOCALE);
}

async function loadProfile(
  source: CompareProfileSource,
  sessionId: string,
): Promise<{ profile: Profile; teaser: unknown; label: string } | null> {
  if (source === "golden") return { profile: GOLDEN_PROFILE, teaser: MOCK_TEASERS[LOCALE], label: "golden" };
  if (source === "golden_no_goal") {
    return { profile: GOLDEN_PROFILE_NO_GOAL, teaser: MOCK_TEASERS[LOCALE], label: "golden_no_goal" };
  }
  const id = sessionId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const session = await getDb().testSession.findUnique({
    where: { id },
    select: { status: true, profile: true, teasers: { where: { status: "ready" }, orderBy: { createdAt: "asc" } } },
  });
  if (!session || session.status !== "survey_done" || !session.profile) return null;
  // Тизер — вход для части отчёта: узбекский, если есть, иначе любой готовый, иначе образец.
  const teaser =
    session.teasers.find((t) => t.locale === LOCALE)?.content ?? session.teasers[0]?.content ?? MOCK_TEASERS[LOCALE];
  return { profile: session.profile as unknown as Profile, teaser, label: `session:${id}` };
}

export async function startComparison(options: {
  adminId: string;
  adminLogin: string;
  source: CompareProfileSource;
  sessionId: string;
  kind: CompareKind;
  part: ComparePart | null;
  models: [string, string];
}): Promise<StartResult> {
  const models = options.models.map((m) => m.trim()) as [string, string];
  if (!models[0] || !models[1]) return { ok: false, error: "bad_input" };
  if (options.kind !== "teaser" && !options.part) return { ok: false, error: "bad_input" };
  const aiMode = getAiMode();
  for (const m of models) {
    const error = modelSaveError(m, hasOpenAiKey());
    // В тестовом режиме ИИ ключ OpenAI не нужен: обе генерации всё равно отдаёт заглушка.
    if (error === "bad_name" || (error === "openai_key" && aiMode === "live")) return { ok: false, error };
  }
  const input = await loadProfile(options.source, options.sessionId);
  if (!input) return { ok: false, error: "session_not_found" };
  const allowed = await checkAndHitRateLimit(`compare:${options.adminId}`, COMPARE_LIMIT_PER_HOUR, 60 * 60_000);
  if (!allowed) return { ok: false, error: "rate_limit" };

  const promptVersion = await getActivePromptVersion(promptKeyOf(options.kind));
  // Модели раскладываются по «Variant 1 / Variant 2» случайно — владелец не должен угадывать по порядку ввода.
  const order = randomInt(2) === 0 ? models : ([models[1], models[0]] as [string, string]);
  const comparison = await getDb().modelComparison.create({
    data: {
      createdBy: options.adminLogin,
      profileSource: input.label,
      profile: input.profile as unknown as Prisma.InputJsonValue,
      teaser: input.teaser as Prisma.InputJsonValue,
      kind: options.kind,
      part: options.kind === "teaser" ? null : options.part,
      locale: LOCALE,
      promptVersion: promptVersionLabel(promptVersion),
      aiMode,
      variants: { create: order.map((model, i) => ({ slot: i + 1, model })) },
    },
    select: { id: true },
  });
  return { ok: true, id: comparison.id };
}

export async function getComparison(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return getDb().modelComparison.findUnique({
    where: { id },
    include: { variants: { orderBy: { slot: "asc" } } },
  });
}

export type ComparisonRow = NonNullable<Awaited<ReturnType<typeof getComparison>>>;

export interface CompareState {
  // Без названий моделей: до оценки браузер их не получает.
  variants: { slot: number; status: "generating" | "ready" | "failed" }[];
  done: boolean;
}

function isStale(lockedAt: Date | null): boolean {
  return lockedAt !== null && Date.now() - lockedAt.getTime() > REPORT_STALE_LOCK_MS;
}

function toState(variants: { slot: number; status: string }[]): CompareState {
  const list = variants.map((v) => ({
    slot: v.slot,
    status: v.status === "ready" ? ("ready" as const) : v.status === "failed" ? ("failed" as const) : ("generating" as const),
  }));
  return { variants: list, done: list.every((v) => v.status !== "generating") };
}

// Продвигает сравнение: сообщает статус и, если есть вариант, который сейчас никто не генерирует,
// запускает одну его попытку (job — выполняется через after() после ответа браузеру).
export async function advanceComparison(id: string): Promise<{ state: CompareState | null; job?: () => Promise<void> }> {
  const db = getDb();
  const comparison = await getComparison(id);
  if (!comparison) return { state: null };

  for (const v of comparison.variants) {
    if (v.status !== "generating" || !isStale(v.lockedAt) || v.attempt < MAX_PART_ATTEMPTS) continue;
    // Последняя попытка зависла (сервер оборвал запрос) — не крутим дальше.
    await db.modelComparisonVariant.updateMany({
      where: { id: v.id, lockedAt: v.lockedAt },
      data: { status: "failed", error: "timeout", lockedAt: null },
    });
    v.status = "failed";
  }

  const variant = comparison.variants.find(
    (v) => (v.status === "pending" || v.status === "generating") && (v.lockedAt === null || isStale(v.lockedAt)),
  );
  if (!variant) return { state: toState(comparison.variants) };

  // «Захватываем» вариант атомарно: две вкладки не запустят одну попытку дважды.
  const claimed = await db.modelComparisonVariant.updateMany({
    where: { id: variant.id, updatedAt: variant.updatedAt },
    data: { status: "generating", lockedAt: new Date(), attempt: { increment: 1 } },
  });
  const states = comparison.variants.map((v) => (v.id === variant.id ? { ...v, status: "generating" } : v));
  if (claimed.count === 0) return { state: toState(states) };

  const job = () => runVariantAttempt(comparison, { ...variant, attempt: variant.attempt + 1 });
  return { state: toState(states), job };
}

type VariantRow = ComparisonRow["variants"][number];

async function runVariantAttempt(comparison: ComparisonRow, variant: VariantRow): Promise<void> {
  const db = getDb();
  const aiMode = comparison.aiMode === "live" ? getAiMode() : "mock";
  const model = modelFor(aiMode, variant.model);
  const provider = getAiProvider(aiMode, model);
  const kind = comparison.kind as CompareKind;
  const profile = comparison.profile as unknown as Profile;
  // Та же версия промпта, что была активной при запуске сравнения, — для обоих вариантов.
  const key = promptKeyOf(kind);
  const parsed = parsePromptVersionLabel(comparison.promptVersion);
  const promptVersion =
    (parsed ? await getPromptVersionByNumber(key, parsed.version) : null) ?? (await getActivePromptVersion(key));
  const templates = { system: promptVersion.systemTemplate, user: promptVersion.userTemplate };

  // Итоги по всем попыткам варианта.
  let costUsd: number | null = variant.attempt > 1 ? variant.costUsd : 0;
  let durationMs = variant.attempt > 1 ? variant.durationMs : 0;
  let inputTokens = variant.attempt > 1 ? variant.inputTokens : 0;
  let outputTokens = variant.attempt > 1 ? variant.outputTokens : 0;
  const logCall = async (log: {
    attempt: number;
    ok: boolean;
    error: string | null;
    problems: string[];
    responseText: string;
    usage: TokenUsage;
    durationMs: number;
    part: string;
  }) => {
    const cost = provider.estimateCostUsd(model, log.usage);
    costUsd = costUsd === null || cost === null ? null : Math.round((costUsd + cost) * 1_000_000) / 1_000_000;
    durationMs += log.durationMs;
    inputTokens += log.usage.inputTokens + log.usage.cacheReadTokens + log.usage.cacheWriteTokens;
    outputTokens += log.usage.outputTokens;
    console.info(
      `[ai] compare=${comparison.id} slot=${variant.slot} part=${log.part} provider=${provider.name} model=${model}` +
        ` attempt=${log.attempt} ok=${log.ok} in=${log.usage.inputTokens} out=${log.usage.outputTokens}` +
        ` cost=$${cost ?? "?"} ms=${log.durationMs}${log.error ? ` error=${log.error}` : ""}`,
    );
    await db.aiCall.create({
      data: {
        kind: "compare",
        part: log.part,
        comparisonId: comparison.id,
        aiMode,
        model,
        promptVersion: comparison.promptVersion,
        attempt: log.attempt,
        ok: log.ok,
        error: log.error,
        locale: comparison.locale,
        problems: log.problems.length > 0 ? log.problems : Prisma.DbNull,
        responseText: log.responseText ? log.responseText.slice(0, 20_000) : null,
        ...log.usage,
        costUsd: cost,
        durationMs: log.durationMs,
      },
    });
  };
  const totals = () => ({ costUsd, durationMs, inputTokens, outputTokens, lockedAt: null });

  try {
    if (kind === "teaser") {
      // Тизер — как на боевом сайте: обе попытки (первая + повтор с подсказкой) в одном запросе,
      // в пределах TEASER_TIME_BUDGET_MS.
      let lastProblems: string[] = [];
      const result = await generateTeaser({
        profile,
        locale: LOCALE,
        model,
        provider,
        templates,
        onAttempt: async (log) => {
          lastProblems = log.problems;
          await logCall({ ...log, part: "teaser" });
        },
      });
      await db.modelComparisonVariant.update({
        where: { id: variant.id },
        data: result.ok
          ? { ...totals(), status: "ready", content: result.content as Prisma.InputJsonValue, error: null, problems: Prisma.DbNull }
          : { ...totals(), status: "failed", error: result.error.slice(0, 300), problems: lastProblems },
      });
      return;
    }

    // Часть отчёта — одна попытка на запрос; повтор (с прошлым ответом и списком проблем) —
    // следующим запросом, как у полного отчёта на боевом сайте.
    const level = levelOf(kind)!;
    const part = comparison.part as ComparePart;
    const pathType = profile.path_type as ReportPathType;
    // Части перед сравниваемой — из образца тестового режима, одинаковые для обоих вариантов.
    const previousParts = Object.fromEntries(
      REPORT_PARTS.slice(0, REPORT_PARTS.indexOf(part)).map((p) => [p, mockReportPart(LOCALE, p, pathType)]),
    );
    const retry = variant.retry as { previousResponse: string; problems: string[] } | null;
    const result = await runReportPartAttempt({
      part,
      profile,
      teaser: comparison.teaser ?? MOCK_TEASERS[LOCALE],
      locale: LOCALE,
      level,
      pathType,
      previousParts,
      model,
      provider,
      templates,
      retry: variant.attempt > 1 && retry ? retry : undefined,
    });
    const accept = shouldAcceptDespiteWarnings(variant.attempt, result);
    await logCall({
      ...result,
      attempt: variant.attempt,
      error: accept ? `${result.error ?? "unknown"}:accepted_despite_warnings` : result.error,
      part,
    });
    if (result.ok || accept) {
      await db.modelComparisonVariant.update({
        where: { id: variant.id },
        data: {
          ...totals(),
          status: "ready",
          content: result.content as Prisma.InputJsonValue,
          // Принято с предупреждением — как на боевом сайте; замечания оставляем, чтобы их было видно.
          error: accept ? "accepted_despite_warnings" : null,
          problems: accept ? result.problems : Prisma.DbNull,
          retry: Prisma.DbNull,
        },
      });
      return;
    }
    const canRetry = !result.fatal && variant.attempt < MAX_PART_ATTEMPTS;
    await db.modelComparisonVariant.update({
      where: { id: variant.id },
      data: canRetry
        ? {
            ...totals(),
            retry: result.responseText.trim()
              ? { previousResponse: result.responseText, problems: result.problems }
              : Prisma.DbNull,
          }
        : {
            ...totals(),
            status: "failed",
            content: result.content === undefined ? Prisma.DbNull : (result.content as Prisma.InputJsonValue),
            error: (result.error ?? "unknown").slice(0, 300),
            problems: result.problems,
            retry: Prisma.DbNull,
          },
    });
  } catch (error) {
    await logError("ai-compare", error, { comparisonId: comparison.id, slot: variant.slot });
    await db.modelComparisonVariant
      .update({ where: { id: variant.id }, data: { status: "failed", error: "crash", lockedAt: null } })
      .catch(() => {});
  }
}

export async function rateComparison(id: string, verdict: CompareVerdict, comment: string): Promise<boolean> {
  const updated = await getDb().modelComparison.updateMany({
    // Оценку ставят один раз: после неё модели уже раскрыты, и вторая оценка была бы не слепой.
    where: { id, verdict: null },
    data: { verdict, comment: comment.trim().slice(0, 2000) || null, ratedAt: new Date() },
  });
  return updated.count > 0;
}

export async function listComparisons(take = 200) {
  return getDb().modelComparison.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      kind: true,
      part: true,
      profileSource: true,
      verdict: true,
      createdAt: true,
      variants: { select: { slot: true, model: true, status: true, costUsd: true } },
    },
  });
}

// Средний объём одной попытки на узбекском по журналу (последние удачные вызовы настоящего ИИ) —
// для оценки стоимости пары перед запуском. Если настоящих вызовов ещё не было — DEFAULT_TOKEN_GUESS.
export async function tokenGuesses(): Promise<Record<"teaser" | ComparePart, TokenGuess>> {
  const keys = ["teaser", ...REPORT_PARTS] as const;
  const entries = await Promise.all(
    keys.map(async (key) => {
      const calls = await getDb().aiCall.findMany({
        where: {
          aiMode: "live",
          ok: true,
          locale: LOCALE,
          ...(key === "teaser" ? { kind: "teaser" } : { kind: "report", part: key }),
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
      });
      if (calls.length === 0) return [key, DEFAULT_TOKEN_GUESS[key]] as const;
      const avg = (f: (c: (typeof calls)[number]) => number) => Math.round(calls.reduce((s, c) => s + f(c), 0) / calls.length);
      return [
        key,
        { input: avg((c) => c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens), output: avg((c) => c.outputTokens) },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<"teaser" | ComparePart, TokenGuess>;
}
