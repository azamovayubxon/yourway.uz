import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Фальшивая база: считает и создаёт строки RateLimitHit так же, как настоящая (count + create),
// только в памяти — чтобы проверить настоящую логику checkAndHitRateLimit, а не её копию.
let hits: { key: string; createdAt: Date }[] = [];

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    rateLimitHit: {
      count: ({ where }: { where: { key: string; createdAt: { gte: Date } } }) =>
        Promise.resolve(hits.filter((h) => h.key === where.key && h.createdAt >= where.createdAt.gte).length),
      create: ({ data }: { data: { key: string } }) => {
        hits.push({ key: data.key, createdAt: new Date() });
        return Promise.resolve();
      },
    },
  }),
}));

const { checkAndHitRateLimit } = await import("./rate-limit");

describe("checkAndHitRateLimit — лимит на кнопку «Проверить» в /admin/prompts (этап 10А)", () => {
  beforeEach(() => {
    hits = [];
  });

  it("30 вызовов проходят, 31-й (и следующие) — нет", async () => {
    const key = "promptcheck:admin-1";
    const max = 30;
    const windowMs = 60 * 60_000;
    const results: boolean[] = [];
    for (let i = 0; i < 33; i++) {
      results.push(await checkAndHitRateLimit(key, max, windowMs));
    }
    expect(results.slice(0, 30)).toEqual(Array(30).fill(true));
    expect(results[30]).toBe(false);
    expect(results[31]).toBe(false);
    expect(results[32]).toBe(false);
  });

  it("лимит считается отдельно для каждого ключа (разные админы друг другу не мешают)", async () => {
    const max = 30;
    const windowMs = 60 * 60_000;
    for (let i = 0; i < 30; i++) await checkAndHitRateLimit("promptcheck:admin-a", max, windowMs);
    expect(await checkAndHitRateLimit("promptcheck:admin-a", max, windowMs)).toBe(false);
    expect(await checkAndHitRateLimit("promptcheck:admin-b", max, windowMs)).toBe(true);
  });
});
