import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/assessment/profile";
import { MAX_PART_ATTEMPTS, afterFailedAttempt, shouldAcceptDespiteWarnings } from "@/lib/report/progress";
import { GOLDEN_PROFILE } from "./golden-profile";
import { MOCK_TEASERS } from "./mock-teasers";
import { REPORT_PARTS } from "./prompts";
import { AiFatalError, createFailingProvider, createMockProvider, ZERO_USAGE, type AiProvider } from "./providers";
import { runReportPartAttempt, type PartAttemptResult } from "./report";
import { generateTeaserWithFallback, type AttemptLog } from "./teaser";

// Страховка (два поставщика ИИ): если модель OpenAI не справилась окончательно, генерация
// повторяется на Claude-модели по умолчанию. Здесь «OpenAI» — падающий поставщик, «Claude» — заглушка.

const fatalProvider: AiProvider = {
  name: "openai",
  estimateCostUsd: () => null,
  async call() {
    throw new AiFatalError("AuthenticationError: bad key");
  },
};

describe("страховка тизера на Claude", () => {
  it("исчерпаны повторы у OpenAI → тизер пишет Claude, в журнале видно подмену", async () => {
    const logs: [number, boolean, string, string | null][] = [];
    const result = await generateTeaserWithFallback({
      profile: GOLDEN_PROFILE,
      locale: "uz",
      model: "gpt-6-sol",
      provider: createFailingProvider(0),
      fallback: { model: "claude-sonnet-5", provider: createMockProvider(0) },
      onModelAttempt: (log: AttemptLog, meta) => void logs.push([log.attempt, log.ok, meta.model, meta.fallbackFrom]),
    });
    expect(result).toMatchObject({ ok: true, model: "claude-sonnet-5", fallbackFrom: "gpt-6-sol", attempts: 3 });
    // Нумерация продолжается: первая попытка (attempt = 1) одна на тизер — по ней считается лимит по IP.
    expect(logs).toEqual([
      [1, false, "gpt-6-sol", null],
      [2, false, "gpt-6-sol", null],
      [3, true, "claude-sonnet-5", "gpt-6-sol"],
    ]);
  });

  it("фатальная ошибка OpenAI (неверный ключ) → сразу Claude, без второй попытки OpenAI", async () => {
    const models: string[] = [];
    const result = await generateTeaserWithFallback({
      profile: GOLDEN_PROFILE,
      locale: "uz",
      model: "gpt-6-sol",
      provider: fatalProvider,
      fallback: { model: "claude-sonnet-5", provider: createMockProvider(0) },
      onModelAttempt: (_log, meta) => void models.push(meta.model),
    });
    expect(result.ok).toBe(true);
    expect(models).toEqual(["gpt-6-sol", "claude-sonnet-5"]);
    if (result.ok) expect(result.content).toEqual(MOCK_TEASERS.uz);
  });

  it("без страховки (модель Claude) — обычная генерация, ошибка остаётся ошибкой", async () => {
    const result = await generateTeaserWithFallback({
      profile: GOLDEN_PROFILE,
      locale: "uz",
      model: "claude-sonnet-5",
      provider: createFailingProvider(0),
    });
    expect(result).toMatchObject({ ok: false, fallbackFrom: null, model: "claude-sonnet-5" });
  });
});

describe("страховка оплаченного отчёта на Claude", () => {
  it("решение после неудачной попытки", () => {
    expect(afterFailedAttempt({ attempt: 1, fatal: false, canFallback: true })).toBe("retry");
    expect(afterFailedAttempt({ attempt: MAX_PART_ATTEMPTS, fatal: false, canFallback: true })).toBe("fallback");
    expect(afterFailedAttempt({ attempt: 1, fatal: true, canFallback: true })).toBe("fallback");
    // Claude (или подмена уже была) — как раньше: «не удалось», кнопка «Сгенерировать заново».
    expect(afterFailedAttempt({ attempt: MAX_PART_ATTEMPTS, fatal: false, canFallback: false })).toBe("fail");
    expect(afterFailedAttempt({ attempt: 1, fatal: true, canFallback: false })).toBe("fail");
  });

  // Тот же цикл, что в src/lib/report/index.ts (там он растянут на запросы к серверу): попытка →
  // принять / повторить / подменить модель / «не удалось».
  async function generateReport(primary: { model: string; provider: AiProvider }, claude: { model: string; provider: AiProvider }) {
    const profile = GOLDEN_PROFILE as Profile;
    const parts: Record<string, unknown> = {};
    const journal: { part: string; attempt: number; model: string; ok: boolean; fallbackFrom: string | null }[] = [];
    let current = primary;
    let fallbackFrom: string | null = null;
    for (const part of REPORT_PARTS) {
      let attempt = 0;
      let retry: { previousResponse: string; problems: string[] } | undefined;
      for (;;) {
        attempt++;
        const result: PartAttemptResult = await runReportPartAttempt({
          part,
          profile,
          teaser: MOCK_TEASERS.uz,
          locale: "uz",
          level: "route",
          pathType: "knows_goal",
          previousParts: parts,
          model: current.model,
          provider: current.provider,
          retry,
        });
        journal.push({ part, attempt, model: current.model, ok: result.ok, fallbackFrom });
        if (result.ok || shouldAcceptDespiteWarnings(attempt, result)) {
          parts[part] = result.content;
          break;
        }
        const next = afterFailedAttempt({ attempt, fatal: result.fatal, canFallback: fallbackFrom === null && current === primary });
        if (next === "fail") return { ok: false as const, journal };
        if (next === "fallback") {
          fallbackFrom = current.model;
          current = claude;
          attempt = 0;
          retry = undefined;
          continue;
        }
        retry = result.responseText.trim() ? { previousResponse: result.responseText, problems: result.problems } : undefined;
      }
    }
    return { ok: true as const, journal, parts };
  }

  it("OpenAI бракует ответы → отчёт всё равно готов: дописывает Claude", async () => {
    const result = await generateReport(
      { model: "gpt-6-sol", provider: createFailingProvider(0) },
      { model: "claude-sonnet-5", provider: createMockProvider(0) },
    );
    expect(result.ok).toBe(true);
    expect(result.journal.map((j) => [j.part, j.attempt, j.model, j.ok, j.fallbackFrom])).toEqual([
      ["portrait_goal", 1, "gpt-6-sol", false, null],
      ["portrait_goal", 2, "gpt-6-sol", false, null],
      ["portrait_goal", 1, "claude-sonnet-5", true, "gpt-6-sol"],
      ["main_path", 1, "claude-sonnet-5", true, "gpt-6-sol"],
      ["finish", 1, "claude-sonnet-5", true, "gpt-6-sol"],
    ]);
  });

  it("неверный ключ OpenAI → подмена после первой же попытки", async () => {
    const result = await generateReport(
      { model: "gpt-6-astra", provider: fatalProvider },
      { model: "claude-opus-5-5", provider: createMockProvider(0) },
    );
    expect(result.ok).toBe(true);
    expect(result.journal[0]).toMatchObject({ model: "gpt-6-astra", ok: false });
    expect(result.journal.slice(1).every((j) => j.model === "claude-opus-5-5" && j.fallbackFrom === "gpt-6-astra")).toBe(true);
  });

  it("если сломан и Claude — «не удалось», без бесконечных повторов", async () => {
    const result = await generateReport(
      { model: "gpt-6-sol", provider: createFailingProvider(0) },
      { model: "claude-sonnet-5", provider: createFailingProvider(0) },
    );
    expect(result.ok).toBe(false);
    expect(result.journal).toHaveLength(2 * MAX_PART_ATTEMPTS);
  });

  it("ZERO_USAGE у упавшей попытки — стоимость не выдумывается", async () => {
    const r = await runReportPartAttempt({
      part: "portrait_goal",
      profile: GOLDEN_PROFILE,
      teaser: MOCK_TEASERS.uz,
      locale: "uz",
      level: "route",
      pathType: "knows_goal",
      previousParts: {},
      model: "gpt-6-sol",
      provider: fatalProvider,
    });
    expect(r).toMatchObject({ ok: false, fatal: true, usage: ZERO_USAGE });
  });
});
