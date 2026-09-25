import { describe, expect, it } from "vitest";
import { REPORT_STALE_LOCK_MS } from "@/lib/ai/config";
import { summarizeReportCalls } from "./ai-log";
import { decideNext, MAX_PART_ATTEMPTS, nextPart, partsDone } from "./progress";

const now = new Date("2026-09-25T12:00:00Z");
const row = (over: Partial<Parameters<typeof decideNext>[0]> = {}) => ({
  status: "generating",
  parts: {},
  partAttempt: 0,
  lockedAt: null,
  ...over,
});

describe("очередь частей полного отчёта", () => {
  it("части идут по порядку: портрет и цель → маршрут → финал", () => {
    expect(nextPart({})).toBe("portrait_goal");
    expect(nextPart({ portrait_goal: {} })).toBe("main_path");
    expect(nextPart({ portrait_goal: {}, main_path: {} })).toBe("finish");
    expect(nextPart({ portrait_goal: {}, main_path: {}, finish: {} })).toBeNull();
    expect(partsDone({ portrait_goal: {}, main_path: {} })).toBe(2);
  });

  it("готовый или неудачный отчёт ничего не запускает", () => {
    expect(decideNext(row({ status: "ready" }), now)).toBe("done");
    expect(decideNext(row({ status: "failed" }), now)).toBe("done");
  });

  it("свободный отчёт — запускаем попытку; занятый — ждём", () => {
    expect(decideNext(row({ status: "pending" }), now)).toBe("start");
    expect(decideNext(row({ lockedAt: new Date(now.getTime() - 10_000), partAttempt: 1 }), now)).toBe("wait");
  });

  it("зависшая попытка: повтор, если попытки остались; иначе сбой (без бесконечных трат)", () => {
    const stale = new Date(now.getTime() - REPORT_STALE_LOCK_MS - 1000);
    expect(decideNext(row({ lockedAt: stale, partAttempt: 1 }), now)).toBe(MAX_PART_ATTEMPTS > 1 ? "start" : "timeout");
    expect(decideNext(row({ lockedAt: stale, partAttempt: MAX_PART_ATTEMPTS }), now)).toBe("timeout");
  });

  it("одна часть — не больше одного повтора (как у тизера)", () => {
    expect(MAX_PART_ATTEMPTS).toBe(2);
  });
});

describe("сводка по отчёту для /dev/ai-log", () => {
  it("суммирует время, токены и стоимость всех вызовов", () => {
    const sum = summarizeReportCalls([
      { durationMs: 1000, costUsd: 0.1, inputTokens: 10, outputTokens: 20, cacheReadTokens: 5 },
      { durationMs: 2500, costUsd: 0.05, inputTokens: 1, outputTokens: 2, cacheReadTokens: 3 },
    ]);
    expect(sum).toEqual({ calls: 2, totalMs: 3500, costUsd: 0.15, inputTokens: 11, outputTokens: 22, cacheReadTokens: 8 });
    expect(summarizeReportCalls([{ durationMs: 1, costUsd: null, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }]).costUsd).toBeNull();
  });
});
