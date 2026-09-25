import { afterEach, describe, expect, it, vi } from "vitest";
import { testPaymentsEnabled } from "./config";
import { checkPromo, discountedAmount, normalizePromoCode, type PromoRow } from "./promo";
import { activePaymentProvider } from "./providers";

const promo = (over: Partial<PromoRow> = {}): PromoRow => ({
  percentOff: 50,
  active: true,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  testOnly: false,
  ...over,
});
const now = new Date("2026-09-25T12:00:00Z");

describe("промокоды", () => {
  it("код нормализуется: без пробелов, в верхнем регистре", () => {
    expect(normalizePromoCode(" test 100 ")).toBe("TEST100");
  });

  it("проверка: нет, выключен, истёк, исчерпан", () => {
    expect(checkPromo(null, { now, testAllowed: true })).toEqual({ ok: false, error: "promo_not_found" });
    expect(checkPromo(promo({ active: false }), { now, testAllowed: true })).toEqual({ ok: false, error: "promo_inactive" });
    expect(checkPromo(promo({ expiresAt: new Date("2026-09-01") }), { now, testAllowed: true })).toEqual({
      ok: false,
      error: "promo_expired",
    });
    expect(checkPromo(promo({ maxUses: 3, usedCount: 3 }), { now, testAllowed: true })).toEqual({
      ok: false,
      error: "promo_used_up",
    });
    expect(checkPromo(promo({ maxUses: 3, usedCount: 2 }), { now, testAllowed: true })).toEqual({ ok: true, percentOff: 50 });
  });

  it("тестовый код на боевом сайте как будто не существует", () => {
    expect(checkPromo(promo({ testOnly: true }), { now, testAllowed: false })).toEqual({ ok: false, error: "promo_not_found" });
    expect(checkPromo(promo({ testOnly: true }), { now, testAllowed: true }).ok).toBe(true);
  });

  it("сумма со скидкой: 100 % — ноль, иначе округление до 100 сум вверх", () => {
    expect(discountedAmount(29_000, 100)).toBe(0);
    expect(discountedAmount(29_000, 50)).toBe(14_500);
    expect(discountedAmount(79_000, 15)).toBe(67_200);
    expect(discountedAmount(29_000, 0)).toBe(29_000);
  });
});

describe("тестовая оплата — только на Preview, никогда на боевом сайте", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("Vercel Preview + PAYMENTS_TEST_MODE=true — включена", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
    expect(testPaymentsEnabled()).toBe(true);
    expect(activePaymentProvider()?.id).toBe("test");
  });

  it("боевой сайт Vercel — выключена, даже если переменную включили по ошибке", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
    expect(testPaymentsEnabled()).toBe(false);
    expect(activePaymentProvider()).toBeNull();
  });

  it("свой сервер с NODE_ENV=production — выключена", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
    expect(testPaymentsEnabled()).toBe(false);
  });

  it("без PAYMENTS_TEST_MODE=true — выключена", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PAYMENTS_TEST_MODE", "false");
    expect(testPaymentsEnabled()).toBe(false);
  });
});
