import { isProductionSite } from "@/lib/dev";

// Тестовая оплата (без реальных денег) включается ТОЛЬКО если одновременно:
//   1) PAYMENTS_TEST_MODE=true (на Vercel эту переменную задают только для Preview);
//   2) это не боевой сайт (на Vercel — VERCEL_ENV ≠ production, вне Vercel — NODE_ENV ≠ production).
// Второе условие — страховка: даже если переменную по ошибке включат для Production,
// на боевом сайте тестовая оплата всё равно не заработает.
export function testPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_TEST_MODE?.trim() === "true" && !isProductionSite();
}
