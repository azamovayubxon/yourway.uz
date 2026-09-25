"use server";

import { redirect } from "next/navigation";
import { login, logout, recover, register, type AuthError } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/credentials";
import { getLocale } from "@/i18n/server";

// Формы аккаунта (регистрация, вход, восстановление, выход). Server actions Next.js сами проверяют,
// что форма отправлена с нашего сайта (защита от CSRF).

export type AuthFormState =
  | { status: "idle" }
  // login — что человек ввёл в поле логина: форма после отправки очищается, а логин возвращаем обратно.
  | { status: "error"; error: AuthError | "server"; minutes?: number; login: string }
  // Код восстановления показывается один раз: он есть только в ответе на эту отправку формы.
  | { status: "code"; login: string; recoveryCode: string; next: string };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function serverError(e: unknown, loginValue: string): AuthFormState {
  console.error("[auth]", e);
  return { status: "error", error: "server", login: loginValue };
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const loginValue = field(formData, "login");
  const next = safeNextPath(field(formData, "next"), "/account");
  try {
    const result = await register({ login: loginValue, password: field(formData, "password"), locale: await getLocale() });
    if (!result.ok) return { status: "error", error: result.error, minutes: result.minutes, login: loginValue };
    return { status: "code", login: result.login, recoveryCode: result.recoveryCode, next };
  } catch (e) {
    return serverError(e, loginValue);
  }
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const loginValue = field(formData, "login");
  try {
    const result = await login({ login: loginValue, password: field(formData, "password") });
    if (!result.ok) return { status: "error", error: result.error, minutes: result.minutes, login: loginValue };
  } catch (e) {
    return serverError(e, loginValue);
  }
  redirect(safeNextPath(field(formData, "next"), "/account"));
}

export async function recoverAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const loginValue = field(formData, "login");
  const next = safeNextPath(field(formData, "next"), "/account");
  try {
    const result = await recover({
      login: loginValue,
      code: field(formData, "code"),
      newPassword: field(formData, "password"),
    });
    if (!result.ok) return { status: "error", error: result.error, minutes: result.minutes, login: loginValue };
    return { status: "code", login: result.login, recoveryCode: result.recoveryCode, next };
  } catch (e) {
    return serverError(e, loginValue);
  }
}

export async function logoutAction() {
  await logout();
  redirect("/");
}
