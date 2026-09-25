import { describe, expect, it } from "vitest";
import { summarizeTeaserDurations } from "./ai-log";

const at = (min: number) => new Date(Date.UTC(2026, 8, 25, 12, min));

describe("сводка длительности тизеров для /dev/ai-log", () => {
  it("складывает попытки одного тизера и считает среднее по языкам", () => {
    const summary = summarizeTeaserDurations([
      { teaserId: "a", locale: "uz", durationMs: 20_000, ok: false, createdAt: at(1) },
      { teaserId: "a", locale: "uz", durationMs: 15_000, ok: true, createdAt: at(2) },
      { teaserId: "b", locale: "uz", durationMs: 25_000, ok: true, createdAt: at(3) },
      { teaserId: "c", locale: "ru", durationMs: 6_000, ok: true, createdAt: at(4) },
      { teaserId: null, locale: "ru", durationMs: 99_000, ok: true, createdAt: at(5) },
    ]);
    expect(summary).toEqual([
      { locale: "ru", teasers: 1, ok: 1, avgMs: 6_000, maxMs: 6_000, retried: 0 },
      { locale: "uz", teasers: 2, ok: 2, avgMs: 30_000, maxMs: 35_000, retried: 1 },
    ]);
  });

  it("берёт только последние N тизеров языка", () => {
    const calls = [1, 2, 3].map((i) => ({ teaserId: `t${i}`, locale: "uz", durationMs: i * 1000, ok: true, createdAt: at(i) }));
    expect(summarizeTeaserDurations(calls, 2)[0]).toMatchObject({ teasers: 2, avgMs: 2_500 });
  });
});
