"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cancelPayment, confirmTestPayment, isLevel, previewPromo, startPayment, type PromoPreview } from "@/lib/payments";
import { getCurrentSession } from "@/lib/session";
import { isLocale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { logError } from "@/lib/monitoring";

// Оплата (этап 6). Server actions Next.js сами проверяют, что форма отправлена с нашего сайта (защита от CSRF).

export type CheckoutState = { status: "idle" } | { status: "error"; error: string };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Проверка промокода до оплаты: показать скидку и новую цену.
export async function previewPromoAction(code: string): Promise<PromoPreview | { ok: false; error: "server" }> {
  try {
    return await previewPromo(code.slice(0, 64));
  } catch (e) {
    await logError("payments-promo-preview", e);
    return { ok: false, error: "server" };
  }
}

export async function startPaymentAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/register?next=/checkout");
  const session = await getCurrentSession();
  if (!session || session.status !== "survey_done") redirect("/teaser");
  const level = field(formData, "level");
  if (!isLevel(level)) return { status: "error", error: "no_price" };
  // Язык отчёта — явный выбор на checkout (UX-06), а не язык интерфейса на момент оплаты:
  // это отдельное поле формы; на случай его отсутствия (например, JS отключён) — язык сайта.
  const reportLocaleField = field(formData, "reportLocale");
  const reportLocale = isLocale(reportLocaleField) ? reportLocaleField : await getLocale();

  let target: string;
  try {
    const result = await startPayment({
      userId: user.id,
      sessionId: session.id,
      level,
      locale: reportLocale,
      promoCode: field(formData, "promo"),
    });
    if (!result.ok) return { status: "error", error: result.error };
    target = result.redirectUrl;
  } catch (e) {
    await logError("payments-start", e, { level });
    return { status: "error", error: "server" };
  }
  redirect(target);
}

// Тестовая страница оплаты: «Оплатить», «Имитировать отказ банка», «Отменить».
export async function testPaymentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  const paymentId = field(formData, "paymentId");
  const outcome = field(formData, "outcome");
  if (outcome === "pay") {
    const result = await confirmTestPayment(paymentId, user.id);
    if (result.ok) redirect(`/report/${result.reportId}`);
    redirect(`/checkout?error=${result.error}`);
  }
  await cancelPayment(paymentId, user.id, outcome === "decline" ? "failed" : "cancelled");
  redirect(`/checkout?${outcome === "decline" ? "declined" : "cancelled"}=1`);
}
