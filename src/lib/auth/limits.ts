// Защита от перебора паролей (CLAUDE.md §6). Решение «можно ли сейчас попробовать войти» — чистая
// функция от журнала попыток (таблица AuthAttempt), её проверяют автотесты limits.test.ts.
//
// Правила (числа — в настройках, см. .env.example):
//  - по логину: AUTH_MAX_FAILURES неудачных попыток (вход и восстановление вместе) за AUTH_LOCK_MINUTES
//    минут → вход в этот аккаунт временно закрыт. Удачный вход обнуляет счётчик;
//  - по IP: AUTH_MAX_FAILURES_PER_IP неудачных попыток с одного IP за то же окно → закрыт вход в любые
//    аккаунты с этого IP (защита от перебора разных логинов). Порог высокий: через один IP выходят школы
//    и мобильные операторы;
//  - регистрация: не больше AUTH_REGISTER_PER_IP_PER_HOUR новых аккаунтов с одного IP за час.
// Сам заблокированный запрос в журнал не пишется, поэтому блокировка не продлевается сама собой.

export interface AuthLimits {
  maxFailures: number;
  lockMinutes: number;
  maxFailuresPerIp: number;
  registerPerIpPerHour: number;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function getAuthLimits(): AuthLimits {
  return {
    maxFailures: intFromEnv("AUTH_MAX_FAILURES", 5),
    lockMinutes: intFromEnv("AUTH_LOCK_MINUTES", 15),
    maxFailuresPerIp: intFromEnv("AUTH_MAX_FAILURES_PER_IP", 50),
    registerPerIpPerHour: intFromEnv("AUTH_REGISTER_PER_IP_PER_HOUR", 20),
  };
}

export interface Attempt {
  ok: boolean;
  createdAt: Date;
}

export type LockDecision = { locked: false } | { locked: true; retryAfterMinutes: number };

const MINUTE = 60_000;

// Если в окне набралось max «плохих» попыток — закрыто до момента, когда самая старая из них
// выйдет из окна. Возвращает, сколько минут ждать (с округлением вверх, минимум 1).
function lockFromFailures(failures: Date[], max: number, windowMs: number, now: Date): LockDecision {
  const inWindow = failures
    .filter((d) => now.getTime() - d.getTime() < windowMs)
    .sort((a, b) => a.getTime() - b.getTime());
  if (inWindow.length < max) return { locked: false };
  const unlockAt = inWindow[inWindow.length - max].getTime() + windowMs;
  return { locked: true, retryAfterMinutes: Math.max(1, Math.ceil((unlockAt - now.getTime()) / MINUTE)) };
}

// Можно ли попробовать войти (или восстановить доступ) в этот логин с этого IP.
export function checkLoginLock(input: {
  // Попытки входа и восстановления по этому логину (достаточно последних за окно).
  loginAttempts: Attempt[];
  // Неудачные попытки входа и восстановления с этого IP за окно.
  ipFailures: Date[];
  limits: AuthLimits;
  now: Date;
}): LockDecision {
  const { loginAttempts, ipFailures, limits, now } = input;
  const windowMs = limits.lockMinutes * MINUTE;

  // Считаем только неудачи после последнего удачного входа.
  const lastOk = Math.max(0, ...loginAttempts.filter((a) => a.ok).map((a) => a.createdAt.getTime()));
  const loginFailures = loginAttempts.filter((a) => !a.ok && a.createdAt.getTime() > lastOk).map((a) => a.createdAt);

  const byLogin = lockFromFailures(loginFailures, limits.maxFailures, windowMs, now);
  const byIp = lockFromFailures(ipFailures, limits.maxFailuresPerIp, windowMs, now);
  if (byLogin.locked && byIp.locked) {
    return { locked: true, retryAfterMinutes: Math.max(byLogin.retryAfterMinutes, byIp.retryAfterMinutes) };
  }
  return byLogin.locked ? byLogin : byIp;
}

// Можно ли создать ещё один аккаунт с этого IP.
export function checkRegisterLimit(input: { ipRegistrations: Date[]; limits: AuthLimits; now: Date }): LockDecision {
  return lockFromFailures(input.ipRegistrations, input.limits.registerPerIpPerHour, 60 * MINUTE, input.now);
}
