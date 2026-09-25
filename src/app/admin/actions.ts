"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin/guard";
import { MODEL_OVERRIDE_KEYS, setModelOverride, type ModelOverrideKey } from "@/lib/admin/models";
import { isLevel } from "@/lib/payments/prices";
import { normalizePromoCode } from "@/lib/payments/promo";
import { normalizeLogin } from "@/lib/auth/credentials";
import { activatePromptVersion, createPromptVersion } from "@/lib/ai/prompt-store";
import { PROMPT_KEYS, type PromptKey } from "@/lib/ai/prompt-registry";
import { runPromptCheck, type PromptCheckResult } from "@/lib/ai/prompt-check";

// Действия админки (этап 8). Каждое проверяет роль заново на сервере — ссылка на кнопку
// в браузере ничего не значит, если у человека нет прав.

export async function updatePriceAction(formData: FormData) {
  await requireAdmin();
  const level = String(formData.get("level") ?? "");
  const amount = Math.round(Number(formData.get("amount")));
  if (!isLevel(level) || !Number.isFinite(amount) || amount < 0) redirect("/admin/prices?error=1");
  await getDb().price.upsert({ where: { level }, create: { level, amount }, update: { amount } });
  redirect("/admin/prices?ok=1");
}

export async function createPromoAction(formData: FormData) {
  await requireAdmin();
  const code = normalizePromoCode(String(formData.get("code") ?? ""));
  const percent = Math.round(Number(formData.get("percent")));
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const maxUses = maxUsesRaw ? Math.round(Number(maxUsesRaw)) : null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  const valid =
    /^[A-Z0-9_-]{3,32}$/.test(code) &&
    percent >= 1 &&
    percent <= 100 &&
    (maxUses === null || (Number.isInteger(maxUses) && maxUses > 0)) &&
    (expiresAt === null || !Number.isNaN(expiresAt.getTime()));
  if (!valid) redirect("/admin/promo?error=1");

  await getDb().promoCode.upsert({
    where: { code },
    create: { code, percentOff: percent, maxUses, expiresAt, testOnly: false },
    update: { percentOff: percent, maxUses, expiresAt, active: true, testOnly: false },
  });
  redirect("/admin/promo?ok=1");
}

export async function togglePromoAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const promo = await getDb().promoCode.findUnique({ where: { id } });
  if (promo) await getDb().promoCode.update({ where: { id }, data: { active: !promo.active } });
  redirect("/admin/promo");
}

export async function deletePromoAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await getDb().promoCode.deleteMany({ where: { id } });
  redirect("/admin/promo");
}

export async function saveModelOverrideAction(formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!MODEL_OVERRIDE_KEYS.includes(key as ModelOverrideKey)) redirect("/admin/prompts?error=1");
  const model = String(formData.get("model") ?? "");
  await setModelOverride(key as ModelOverrideKey, model, admin.login);
  redirect("/admin/prompts?ok=1");
}

function isPromptKey(key: string): key is PromptKey {
  return (PROMPT_KEYS as string[]).includes(key);
}

export type SavePromptState =
  | { status: "idle" }
  | { status: "error"; errors: string[] }
  | { status: "ok"; version: number };

// Сохранение промпта — новая версия сразу активная (требование 2 этапа 8б). Редактировать и
// откатывать может только superadmin (требование 7); admin, попавший сюда напрямую, получит 404.
export async function savePromptVersionAction(_prev: SavePromptState, formData: FormData): Promise<SavePromptState> {
  const admin = await requireSuperAdmin();
  const key = String(formData.get("key") ?? "");
  if (!isPromptKey(key)) return { status: "error", errors: ["Неизвестный ключ промпта."] };
  const systemTemplate = String(formData.get("systemTemplate") ?? "");
  const userTemplate = String(formData.get("userTemplate") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const result = await createPromptVersion({ key, systemTemplate, userTemplate, comment, createdBy: admin.login, activate: true });
  return result.ok ? { status: "ok", version: result.version } : { status: "error", errors: result.errors };
}

// Откат на более раннюю версию (требование 2, кнопка «сделать активной»). Только superadmin.
export async function activatePromptVersionAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const key = String(formData.get("key") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  if (!isPromptKey(key)) redirect("/admin/prompts?error=1");
  const ok = await activatePromptVersion(key, versionId, admin.login);
  redirect(ok ? "/admin/prompts?ok=1" : "/admin/prompts?error=1");
}

export type CheckPromptState =
  | { status: "idle" }
  | { status: "error"; errors: string[] }
  | { status: "done"; result: PromptCheckResult };

// Кнопка «Проверить» (требование 5): прогоняет черновик (несохранённый текст из формы) на
// golden-профиле. Смотреть может и admin, и superadmin — сохранить результат нельзя, это не отчёт.
export async function checkPromptAction(_prev: CheckPromptState, formData: FormData): Promise<CheckPromptState> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!isPromptKey(key)) return { status: "error", errors: ["Неизвестный ключ промпта."] };
  const systemTemplate = String(formData.get("systemTemplate") ?? "");
  const userTemplate = String(formData.get("userTemplate") ?? "");
  try {
    const result = await runPromptCheck(key, systemTemplate, userTemplate);
    return { status: "done", result };
  } catch (e) {
    console.error("[admin] prompt check", e);
    return { status: "error", errors: ["Не получилось проверить — попробуйте ещё раз."] };
  }
}

// Только суперадмин может назначать/снимать роль admin у других аккаунтов (role.ts:
// суперадмины из переменной окружения так и остаются суперадминами вне зависимости от базы).
export async function setUserRoleAction(formData: FormData) {
  await requireSuperAdmin();
  const login = normalizeLogin(String(formData.get("login") ?? ""));
  const role = String(formData.get("role") ?? "");
  if (!login || (role !== "admin" && role !== "user")) redirect("/admin/admins?error=1");
  const user = await getDb().user.findUnique({ where: { login }, select: { id: true } });
  if (!user) redirect("/admin/admins?error=notfound");
  await getDb().user.update({ where: { id: user.id }, data: { role } });
  redirect("/admin/admins?ok=1");
}
