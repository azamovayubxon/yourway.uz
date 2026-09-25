// Служебные страницы для разработки (/dev/...) доступны везде, кроме боевого сайта.
// На Vercel боевой сайт — VERCEL_ENV=production (превью-ссылки при этом открывают /dev).
// На другом хостинге (без VERCEL_ENV) боевой режим — NODE_ENV=production.
export function isProductionSite(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}

export function devToolsEnabled(): boolean {
  return !isProductionSite();
}
