import "server-only";
import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/ip";
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/session";
import type { Locale } from "@/i18n/config";
import {
  generateRecoveryCode,
  normalizeLogin,
  normalizeRecoveryCode,
  validateLogin,
  validatePassword,
  type CredentialError,
} from "./credentials";
import { AUTH_COOKIE, AUTH_MAX_AGE_SEC, hashToken } from "./current";
import { checkLoginLock, checkRegisterLimit, getAuthLimits } from "./limits";

export { getCurrentUser, type CurrentUser } from "./current";

// Аккаунт: регистрация, вход, восстановление по коду, выход (этап 5, CLAUDE.md §6).
// Пароль и код восстановления хранятся только в виде хеша argon2id.

export type AuthError =
  | CredentialError
  | "login_taken"
  | "wrong_credentials"
  | "wrong_code"
  | "wrong_password"
  | "locked"
  | "register_limit";

export type AuthResult<T = object> = ({ ok: true } & T) | { ok: false; error: AuthError; minutes?: number };

const MINUTE = 60_000;

// Хеш для «пустой» проверки, когда логина нет: так ответ приходит за то же время, что и для
// существующего логина, и по скорости ответа нельзя понять, есть ли такой аккаунт.
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hash(randomBytes(16).toString("hex"));
  return dummyHash;
}

async function requestIpHash(): Promise<string | null> {
  return hashIp(clientIp(await headers()));
}

function cookieOptions(maxAge: number) {
  return {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

// Вход на этом устройстве: новая запись AuthSession и cookie с токеном.
async function startAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await getDb().authSession.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + AUTH_MAX_AGE_SEC * 1000) },
  });
  (await cookies()).set(AUTH_COOKIE, token, cookieOptions(AUTH_MAX_AGE_SEC));
}

// После регистрации или входа: анонимная сессия тестов из cookie этого браузера привязывается
// к аккаунту (ответы, баллы, профиль и тизер остаются). Если анонимной сессии нет (вход с другого
// устройства или после выхода) — открываем последнюю сессию аккаунта, чтобы тизер был на месте.
async function bindTestSession(userId: string) {
  const db = getDb();
  const jar = await cookies();
  const cookieId = jar.get(SESSION_COOKIE)?.value;
  if (cookieId && /^[0-9a-f-]{36}$/i.test(cookieId)) {
    // Привязываем только ничью сессию; чужую (другого аккаунта) не трогаем.
    const { count } = await db.testSession.updateMany({
      where: { id: cookieId, OR: [{ userId: null }, { userId }] },
      data: { userId },
    });
    if (count > 0) return;
  }
  const latest = await db.testSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (latest) jar.set(SESSION_COOKIE, latest.id, cookieOptions(SESSION_COOKIE_MAX_AGE));
  else jar.delete(SESSION_COOKIE);
}

async function loginLock(login: string, ipHash: string | null) {
  const limits = getAuthLimits();
  const since = new Date(Date.now() - limits.lockMinutes * MINUTE);
  const db = getDb();
  const [loginAttempts, ipFailures] = await Promise.all([
    db.authAttempt.findMany({
      where: { login, kind: { in: ["login", "recover"] }, createdAt: { gte: since } },
      select: { ok: true, createdAt: true },
    }),
    ipHash
      ? db.authAttempt.findMany({
          where: { ipHash, ok: false, kind: { in: ["login", "recover"] }, createdAt: { gte: since } },
          select: { createdAt: true },
        })
      : [],
  ]);
  return checkLoginLock({
    loginAttempts,
    ipFailures: ipFailures.map((a) => a.createdAt),
    limits,
    now: new Date(),
  });
}

async function logAttempt(kind: "login" | "recover" | "register", login: string, ipHash: string | null, ok: boolean) {
  await getDb().authAttempt.create({ data: { kind, login, ipHash, ok } });
}

// Регистрация: только логин и пароль. Возвращает код восстановления — его показываем один раз.
export async function register(input: {
  login: string;
  password: string;
  locale: Locale;
}): Promise<AuthResult<{ login: string; recoveryCode: string }>> {
  const login = normalizeLogin(input.login);
  const invalid = validateLogin(login) ?? validatePassword(input.password, login);
  if (invalid) return { ok: false, error: invalid };

  const db = getDb();
  const ipHash = await requestIpHash();
  if (ipHash) {
    const registrations = await db.authAttempt.findMany({
      where: { ipHash, kind: "register", ok: true, createdAt: { gte: new Date(Date.now() - 60 * MINUTE) } },
      select: { createdAt: true },
    });
    const limit = checkRegisterLimit({
      ipRegistrations: registrations.map((r) => r.createdAt),
      limits: getAuthLimits(),
      now: new Date(),
    });
    if (limit.locked) return { ok: false, error: "register_limit", minutes: limit.retryAfterMinutes };
  }

  if (await db.user.findUnique({ where: { login }, select: { id: true } })) {
    return { ok: false, error: "login_taken" };
  }

  const recoveryCode = generateRecoveryCode();
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hash(input.password),
    hash(normalizeRecoveryCode(recoveryCode)!),
  ]);
  let userId: string;
  try {
    const user = await db.user.create({
      data: { login, passwordHash, recoveryCodeHash, locale: input.locale },
      select: { id: true },
    });
    userId = user.id;
  } catch (e) {
    // Кто-то занял этот логин в ту же секунду.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "login_taken" };
    }
    throw e;
  }
  await logAttempt("register", login, ipHash, true);
  await startAuthSession(userId);
  await bindTestSession(userId);
  return { ok: true, login, recoveryCode };
}

// Вход по логину и паролю.
export async function login(input: { login: string; password: string }): Promise<AuthResult> {
  const login = normalizeLogin(input.login);
  // Слишком длинный ввод не храним в журнале и не проверяем.
  if (login.length === 0 || login.length > 64 || input.password.length > 1024) {
    return { ok: false, error: "wrong_credentials" };
  }
  const ipHash = await requestIpHash();
  const lock = await loginLock(login, ipHash);
  if (lock.locked) return { ok: false, error: "locked", minutes: lock.retryAfterMinutes };

  const user = await getDb().user.findUnique({ where: { login }, select: { id: true, passwordHash: true } });
  const ok = await verify(user?.passwordHash ?? (await getDummyHash()), input.password).catch(() => false);
  await logAttempt("login", login, ipHash, ok && !!user);
  if (!ok || !user) return { ok: false, error: "wrong_credentials" };

  await startAuthSession(user.id);
  await bindTestSession(user.id);
  return { ok: true };
}

// «Забыли пароль»: логин + код восстановления + новый пароль. После этого старый код не работает
// (выдаётся новый, его снова показываем один раз), а все прежние входы на других устройствах закрываются.
export async function recover(input: {
  login: string;
  code: string;
  newPassword: string;
}): Promise<AuthResult<{ login: string; recoveryCode: string }>> {
  const login = normalizeLogin(input.login);
  if (login.length === 0 || login.length > 64) return { ok: false, error: "wrong_code" };
  const weak = validatePassword(input.newPassword, login);
  if (weak) return { ok: false, error: weak };

  const ipHash = await requestIpHash();
  const lock = await loginLock(login, ipHash);
  if (lock.locked) return { ok: false, error: "locked", minutes: lock.retryAfterMinutes };

  const db = getDb();
  const user = await db.user.findUnique({ where: { login }, select: { id: true, recoveryCodeHash: true } });
  const code = normalizeRecoveryCode(input.code);
  const ok = await verify(user?.recoveryCodeHash ?? (await getDummyHash()), code ?? "-").catch(() => false);
  const success = ok && !!user && !!code;
  await logAttempt("recover", login, ipHash, success);
  if (!success) return { ok: false, error: "wrong_code" };

  const recoveryCode = generateRecoveryCode();
  const [passwordHash, recoveryCodeHash] = await Promise.all([
    hash(input.newPassword),
    hash(normalizeRecoveryCode(recoveryCode)!),
  ]);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash, recoveryCodeHash } }),
    db.authSession.deleteMany({ where: { userId: user.id } }),
  ]);
  await startAuthSession(user.id);
  await bindTestSession(user.id);
  return { ok: true, login, recoveryCode };
}

// Смена пароля из личного кабинета (этап 7): нужен текущий пароль. Вход на других устройствах,
// где человек входил в этот аккаунт, закрывается — остаётся только текущее.
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<AuthResult> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { login: true, passwordHash: true } });
  if (!user) return { ok: false, error: "wrong_password" };
  const weak = validatePassword(input.newPassword, user.login);
  if (weak) return { ok: false, error: weak };
  const ok = await verify(user.passwordHash, input.currentPassword).catch(() => false);
  if (!ok) return { ok: false, error: "wrong_password" };

  const passwordHash = await hash(input.newPassword);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  await db.$transaction([
    db.user.update({ where: { id: input.userId }, data: { passwordHash } }),
    db.authSession.deleteMany({
      where: { userId: input.userId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
    }),
  ]);
  return { ok: true };
}

// Удаление аккаунта (этап 7): нужен пароль для подтверждения. Все данные аккаунта (сессии тестов,
// ответы, профиль, тизеры, оплаты, отчёты) удаляются каскадом на уровне базы (см. schema.prisma).
export async function deleteAccount(input: { userId: string; password: string }): Promise<AuthResult> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { passwordHash: true } });
  if (!user) return { ok: false, error: "wrong_password" };
  const ok = await verify(user.passwordHash, input.password).catch(() => false);
  if (!ok) return { ok: false, error: "wrong_password" };
  await db.user.delete({ where: { id: input.userId } });
  return { ok: true };
}

// Выход: закрываем вход на этом устройстве и «забываем» сессию тестов в браузере, чтобы следующий
// человек за этим устройством не увидел чужой портрет. Сами данные остаются в аккаунте.
export async function logout() {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (token) await getDb().authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(AUTH_COOKIE);
  jar.delete(SESSION_COOKIE);
}
