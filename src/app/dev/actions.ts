"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { devToolsEnabled } from "@/lib/dev";
import { AI_FAIL_COOKIE } from "@/lib/report/dev";

// Действия служебных страниц /dev/... Работают только вне боевого сайта.
// Промокоды переехали в админку (/admin/promo, этап 8) — там же и настоящие, и тестовые коды.

// Имитация сбоя ИИ при генерации полного отчёта — только для этого браузера.
export async function setAiFailAction(formData: FormData) {
  if (!devToolsEnabled()) redirect("/");
  const jar = await cookies();
  if (formData.get("on") === "1") jar.set(AI_FAIL_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 });
  else jar.delete(AI_FAIL_COOKIE);
  redirect("/dev/ai-fail");
}
