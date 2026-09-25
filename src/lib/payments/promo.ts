// Промокоды: проверка кода и расчёт суммы со скидкой. Без базы данных — чистые функции (покрыты тестами).

export type PromoError = "promo_not_found" | "promo_inactive" | "promo_expired" | "promo_used_up";

export interface PromoRow {
  percentOff: number;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  testOnly: boolean;
}

// Код, как его ввёл человек → как он хранится в базе: без пробелов, в верхнем регистре.
export function normalizePromoCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase().slice(0, 64);
}

// Можно ли применить промокод сейчас. Тестовые коды (testOnly, для проверки оплаты) работают только
// там, где включена тестовая оплата, — на боевом сайте их как будто нет.
export function checkPromo(
  promo: PromoRow | null,
  options: { now: Date; testAllowed: boolean },
): { ok: true; percentOff: number } | { ok: false; error: PromoError } {
  if (!promo || (promo.testOnly && !options.testAllowed)) return { ok: false, error: "promo_not_found" };
  if (!promo.active || promo.percentOff < 1 || promo.percentOff > 100) return { ok: false, error: "promo_inactive" };
  if (promo.expiresAt && promo.expiresAt.getTime() <= options.now.getTime()) return { ok: false, error: "promo_expired" };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { ok: false, error: "promo_used_up" };
  return { ok: true, percentOff: promo.percentOff };
}

// Сумма к оплате со скидкой, в сумах. Округляем до 100 сум вверх: копеек (тийинов) на практике нет,
// а «29 000 → 14 500» выглядит аккуратнее, чем «14 537». 100 % — ровно 0.
export function discountedAmount(amount: number, percentOff: number): number {
  if (percentOff >= 100) return 0;
  if (percentOff <= 0) return amount;
  return Math.ceil((amount * (100 - percentOff)) / 100 / 100) * 100;
}
