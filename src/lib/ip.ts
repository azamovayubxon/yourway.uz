import { createHash } from "node:crypto";

// Сам IP-адрес не храним: только его хеш (нужен для мягких лимитов: тизеры, попытки входа).
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`yourway-ip:${ip}`).digest("hex").slice(0, 32);
}

// IP посетителя из заголовков прокси (Vercel и обычный nginx ставят x-forwarded-for).
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}
