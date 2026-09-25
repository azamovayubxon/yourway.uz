"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cancelPayment, confirmTestPayment, isLevel, previewPromo, startPayment, type PromoPreview } from "@/lib/payments";
import { getCurrentSession } from "@/lib/session";
import { getLocale } from "@/i18n/server";

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
    console.error("[payments] promo preview", e);
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

  let target: string;
  try {
    const result = await startPayment({
      userId: user.id,
      sessionId: session.id,
      level,
      locale: await getLocale(),
      promoCode: field(formData, "promo"),
    });
    if (!result.ok) return { status: "error", error: result.error };
    target = result.redirectUrl;
  } catch (e) {
    console.error("[payments] start", e);
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
