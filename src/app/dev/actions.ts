"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { devToolsEnabled } from "@/lib/dev";
import { normalizePromoCode } from "@/lib/payments/promo";
import { AI_FAIL_COOKIE } from "@/lib/report/dev";

// Действия служебных страниц /dev/... Работают только вне боевого сайта.

// Тестовый промокод (testOnly): действует только там, где включена тестовая оплата.
export async function createTestPromoAction(formData: FormData) {
  if (!devToolsEnabled()) redirect("/");
  const code = normalizePromoCode(String(formData.get("code") ?? ""));
  const percent = Math.round(Number(formData.get("percent")));
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !(percent >= 1 && percent <= 100)) redirect("/dev/promo?error=1");
  await getDb().promoCode.upsert({
    where: { code },
    create: { code, percentOff: percent, testOnly: true },
    update: { percentOff: percent, active: true, testOnly: true },
  });
  redirect("/dev/promo?ok=1");
}

export async function togglePromoAction(formData: FormData) {
  if (!devToolsEnabled()) redirect("/");
  const id = String(formData.get("id") ?? "");
  const promo = await getDb().promoCode.findUnique({ where: { id } });
  // Менять здесь можно только тестовые коды: настоящие — забота админки (этап 8).
  if (promo?.testOnly) await getDb().promoCode.update({ where: { id }, data: { active: !promo.active } });
  redirect("/dev/promo");
}

// Имитация сбоя ИИ при генерации полного отчёта — только для этого браузера.
export async function setAiFailAction(formData: FormData) {
  if (!devToolsEnabled()) redirect("/");
  const jar = await cookies();
  if (formData.get("on") === "1") jar.set(AI_FAIL_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 });
  else jar.delete(AI_FAIL_COOKIE);
  redirect("/dev/ai-fail");
}
