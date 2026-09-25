import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { createReportInTx } from "@/lib/report";
import type { Locale } from "@/i18n/config";
import { testPaymentsEnabled } from "./config";
import { checkPromo, discountedAmount, normalizePromoCode, type PromoError } from "./promo";
import { getPrices, LEVELS, type Level } from "./prices";
import { activePaymentProvider } from "./providers";

// Оплата полного отчёта (этап 6, CLAUDE.md §8): цены из базы, промокоды, провайдер `test`.
// Храним только id транзакции, сумму и статус — никаких данных карт.

export { getPrices, getPricesSafe, isLevel, LEVELS, type Level } from "./prices";

async function findPromo(code: string) {
  const normalized = normalizePromoCode(code);
  if (!normalized) return null;
  return getDb().promoCode.findUnique({ where: { code: normalized } });
}

export type PromoPreview = { ok: true; percentOff: number; prices: Partial<Record<Level, number>> } | { ok: false; error: PromoError };

// Проверка промокода до оплаты: скидка и новые цены обоих уровней.
export async function previewPromo(code: string): Promise<PromoPreview> {
  const promo = await findPromo(code);
  const check = checkPromo(promo, { now: new Date(), testAllowed: testPaymentsEnabled() });
  if (!check.ok) return check;
  const base = await getPrices();
  const prices: Partial<Record<Level, number>> = {};
  for (const level of LEVELS) {
    if (base[level] !== undefined) prices[level] = discountedAmount(base[level]!, check.percentOff);
  }
  return { ok: true, percentOff: check.percentOff, prices };
}

export type StartPaymentResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: PromoError | "no_price" | "payments_unavailable" };

class PromoUsedUp extends Error {}

// Промокод засчитывается в момент оплаты. Условное увеличение счётчика: если лимит исчерпан
// (кто-то успел раньше), транзакция откатывается.
async function consumePromo(tx: Prisma.TransactionClient, promoCodeId: string | null) {
  if (!promoCodeId) return;
  const updated = await tx.promoCode.updateMany({
    where: { id: promoCodeId, active: true, OR: [{ maxUses: null }, { usedCount: { lt: tx.promoCode.fields.maxUses } }] },
    data: { usedCount: { increment: 1 } },
  });
  if (updated.count === 0) throw new PromoUsedUp();
}

// Начать оплату выбранного уровня. Промокод на 100 % открывает отчёт сразу, без провайдера.
export async function startPayment(input: {
  userId: string;
  sessionId: string;
  level: Level;
  locale: Locale;
  promoCode: string;
}): Promise<StartPaymentResult> {
  const db = getDb();
  const baseAmount = (await getPrices())[input.level];
  if (baseAmount === undefined) return { ok: false, error: "no_price" };

  let promoCodeId: string | null = null;
  let amount = baseAmount;
  if (input.promoCode.trim()) {
    const promo = await findPromo(input.promoCode);
    const check = checkPromo(promo, { now: new Date(), testAllowed: testPaymentsEnabled() });
    if (!check.ok) return check;
    promoCodeId = promo!.id;
    amount = discountedAmount(baseAmount, check.percentOff);
  }

  const common = {
    userId: input.userId,
    sessionId: input.sessionId,
    level: input.level,
    locale: input.locale,
    baseAmount,
    amount,
    promoCodeId,
  };

  if (amount === 0) {
    try {
      const reportId = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            ...common,
            provider: "promo",
            providerTxnId: `promo-${randomBytes(8).toString("hex")}`,
            status: "paid",
            paidAt: new Date(),
          },
        });
        await consumePromo(tx, promoCodeId);
        return createReportInTx(tx, payment);
      });
      return { ok: true, redirectUrl: `/report/${reportId}` };
    } catch (error) {
      if (error instanceof PromoUsedUp) return { ok: false, error: "promo_used_up" };
      throw error;
    }
  }

  const provider = activePaymentProvider();
  if (!provider) return { ok: false, error: "payments_unavailable" };
  const payment = await db.payment.create({ data: { ...common, provider: provider.id, status: "pending" } });
  return { ok: true, redirectUrl: provider.start(payment).redirectUrl };
}

export async function getUserPayment(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return getDb().payment.findFirst({ where: { id, userId }, include: { report: { select: { id: true } } } });
}

export type ConfirmResult =
  | { ok: true; reportId: string }
  | { ok: false; error: "not_found" | "not_pending" | "payments_unavailable" | "promo_used_up" };

// Тестовый провайдер: человек нажал «Оплатить» на тестовой странице. На этапе 9 то же самое
// будет делать обработчик вебхука настоящего шлюза (после проверки подписи).
export async function confirmTestPayment(paymentId: string, userId: string): Promise<ConfirmResult> {
  if (!testPaymentsEnabled()) return { ok: false, error: "payments_unavailable" };
  const payment = await getUserPayment(paymentId, userId);
  if (!payment || payment.provider !== "test") return { ok: false, error: "not_found" };
  // Повторное нажатие (или обновление страницы) — просто ведём к уже созданному отчёту.
  if (payment.status === "paid" && payment.report) return { ok: true, reportId: payment.report.id };
  if (payment.status !== "pending") return { ok: false, error: "not_pending" };
  try {
    const reportId = await getDb().$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "paid", paidAt: new Date(), providerTxnId: `test-${randomBytes(8).toString("hex")}` },
      });
      if (updated.count === 0) throw new Error("payment: уже обработан");
      await consumePromo(tx, payment.promoCodeId);
      return createReportInTx(tx, payment);
    });
    return { ok: true, reportId };
  } catch (error) {
    if (error instanceof PromoUsedUp) {
      await getDb().payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return { ok: false, error: "promo_used_up" };
    }
    throw error;
  }
}

// Отмена на тестовой странице (или отказ шлюза): доступ не открывается, можно попробовать снова.
export async function cancelPayment(paymentId: string, userId: string, status: "cancelled" | "failed" = "cancelled") {
  const payment = await getUserPayment(paymentId, userId);
  if (!payment) return;
  await getDb().payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status } });
}
