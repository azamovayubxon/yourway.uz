import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLoginLock, checkRegisterLimit, getAuthLimits, type AuthLimits } from "./limits";

const limits: AuthLimits = { maxFailures: 5, lockMinutes: 15, maxFailuresPerIp: 50, registerPerIpPerHour: 20 };
const now = new Date("2026-09-25T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const fail = (m: number) => ({ ok: false, createdAt: minutesAgo(m) });
const success = (m: number) => ({ ok: true, createdAt: minutesAgo(m) });

describe("защита от перебора: по логину", () => {
  it("4 неудачи подряд — ещё можно пробовать", () => {
    const d = checkLoginLock({ loginAttempts: [fail(4), fail(3), fail(2), fail(1)], ipFailures: [], limits, now });
    expect(d.locked).toBe(false);
  });

  it("5 неудач за 15 минут — вход закрыт, пока самая старая не выйдет из окна", () => {
    const d = checkLoginLock({
      loginAttempts: [fail(10), fail(4), fail(3), fail(2), fail(1)],
      ipFailures: [],
      limits,
      now,
    });
    expect(d).toEqual({ locked: true, retryAfterMinutes: 5 });
  });

  it("неудачи старше 15 минут не считаются", () => {
    const d = checkLoginLock({
      loginAttempts: [fail(20), fail(16), fail(3), fail(2), fail(1)],
      ipFailures: [],
      limits,
      now,
    });
    expect(d.locked).toBe(false);
  });

  it("удачный вход обнуляет счётчик", () => {
    const d = checkLoginLock({
      loginAttempts: [fail(9), fail(8), fail(7), success(6), fail(3), fail(2), fail(1)],
      ipFailures: [],
      limits,
      now,
    });
    expect(d.locked).toBe(false);
  });

  it("ждать — минимум 1 минута", () => {
    const d = checkLoginLock({
      loginAttempts: [fail(14.99), fail(4), fail(3), fail(2), fail(1)],
      ipFailures: [],
      limits,
      now,
    });
    expect(d).toEqual({ locked: true, retryAfterMinutes: 1 });
  });
});

describe("защита от перебора: по IP", () => {
  it("50 неудач с одного IP за 15 минут закрывают вход с этого IP в любой логин", () => {
    const ipFailures = Array.from({ length: 50 }, (_, i) => minutesAgo(12 - i * 0.2));
    const d = checkLoginLock({ loginAttempts: [], ipFailures, limits, now });
    expect(d).toEqual({ locked: true, retryAfterMinutes: 3 });
  });

  it("49 неудач — ещё можно", () => {
    const ipFailures = Array.from({ length: 49 }, (_, i) => minutesAgo(10 - i * 0.2));
    expect(checkLoginLock({ loginAttempts: [], ipFailures, limits, now }).locked).toBe(false);
  });

  it("если закрыто и по логину, и по IP — ждать дольше из двух", () => {
    const ipFailures = Array.from({ length: 50 }, (_, i) => minutesAgo(14 - i * 0.2));
    const d = checkLoginLock({
      loginAttempts: [fail(5), fail(4), fail(3), fail(2), fail(1)],
      ipFailures,
      limits,
      now,
    });
    expect(d).toEqual({ locked: true, retryAfterMinutes: 10 });
  });
});

describe("лимит регистраций с одного IP", () => {
  it("20 аккаунтов за час — следующий нельзя", () => {
    const ipRegistrations = Array.from({ length: 20 }, (_, i) => minutesAgo(50 - i));
    expect(checkRegisterLimit({ ipRegistrations, limits, now })).toEqual({ locked: true, retryAfterMinutes: 10 });
  });

  it("регистрации старше часа не считаются", () => {
    const ipRegistrations = Array.from({ length: 20 }, (_, i) => minutesAgo(70 - i));
    expect(checkRegisterLimit({ ipRegistrations, limits, now }).locked).toBe(false);
  });
});

describe("настройки лимитов", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("по умолчанию: 5 попыток, 15 минут, 50 с IP, 20 регистраций в час", () => {
    vi.stubEnv("AUTH_MAX_FAILURES", "");
    vi.stubEnv("AUTH_LOCK_MINUTES", "");
    vi.stubEnv("AUTH_MAX_FAILURES_PER_IP", "");
    vi.stubEnv("AUTH_REGISTER_PER_IP_PER_HOUR", "");
    expect(getAuthLimits()).toEqual(limits);
  });

  it("берутся из переменных окружения; мусор и 0 заменяются значением по умолчанию", () => {
    vi.stubEnv("AUTH_MAX_FAILURES", "3");
    vi.stubEnv("AUTH_LOCK_MINUTES", "0");
    vi.stubEnv("AUTH_MAX_FAILURES_PER_IP", "abc");
    vi.stubEnv("AUTH_REGISTER_PER_IP_PER_HOUR", "7");
    expect(getAuthLimits()).toEqual({ maxFailures: 3, lockMinutes: 15, maxFailuresPerIp: 50, registerPerIpPerHour: 7 });
  });
});
