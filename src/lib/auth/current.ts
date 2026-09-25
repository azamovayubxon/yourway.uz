import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "@/lib/db";

// Кто сейчас вошёл в аккаунт. В cookie `yw_auth` лежит случайный токен, в базе (AuthSession) — его хеш:
// даже если базу украдут, по ней нельзя войти в чужой аккаунт.
export const AUTH_COOKIE = "yw_auth";
// Сколько помнить вход на устройстве: 90 дней.
export const AUTH_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CurrentUser {
  id: string;
  login: string;
}

// Один запрос к базе на всю отрисовку страницы (cache).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const auth = await getDb().authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, login: true } } },
  });
  if (!auth || auth.expiresAt.getTime() <= Date.now()) return null;
  return auth.user;
});
