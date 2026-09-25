import { describe, expect, it } from "vitest";
import { checkTeaserLimits } from "./limits";

const limits = { perSession: 1, langRegenPerSession: 1, perIpPerDay: 30 };

describe("лимиты тизера (решение (К))", () => {
  it("первый тизер в сессии разрешён", () => {
    expect(checkTeaserLimits({ otherLocaleTeasers: 0, ipGenerationsLast24h: 0, limits })).toEqual({ ok: true });
  });

  it("один тизер на другом языке разрешён, второй — нет", () => {
    expect(checkTeaserLimits({ otherLocaleTeasers: 1, ipGenerationsLast24h: 0, limits })).toEqual({ ok: true });
    expect(checkTeaserLimits({ otherLocaleTeasers: 2, ipGenerationsLast24h: 0, limits })).toEqual({
      ok: false,
      reason: "session",
    });
  });

  it("если повтор на другом языке выключен (0), второй язык недоступен", () => {
    const noRegen = { ...limits, langRegenPerSession: 0 };
    expect(checkTeaserLimits({ otherLocaleTeasers: 1, ipGenerationsLast24h: 0, limits: noRegen })).toEqual({
      ok: false,
      reason: "session",
    });
  });

  it("мягкий лимит по IP за сутки", () => {
    expect(checkTeaserLimits({ otherLocaleTeasers: 0, ipGenerationsLast24h: 29, limits }).ok).toBe(true);
    expect(checkTeaserLimits({ otherLocaleTeasers: 0, ipGenerationsLast24h: 30, limits })).toEqual({
      ok: false,
      reason: "ip",
    });
  });
});
