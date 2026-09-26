import "server-only";
import { getDb } from "@/lib/db";

// Общий лимит "не больше max за windowMs" (этап 10А), считается по базе — работает и при нескольких
// серверах. Используется там, где своей таблицы под лимит нет (см. RateLimitHit в schema.prisma).
// Для входа/регистрации/тизера уже есть отдельные механизмы (AuthAttempt, Teaser) — этот только
// для остального (например кнопка «Проверить» в /admin/prompts).
export async function checkAndHitRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) return false;
  await db.rateLimitHit.create({ data: { key } });
  return true;
}
