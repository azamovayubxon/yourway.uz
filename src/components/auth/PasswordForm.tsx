"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordFormState } from "@/app/account/actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { ErrorNote, PasswordField, SubmitButton } from "./fields";

type AuthDict = Dictionary["auth"];
const idle: PasswordFormState = { status: "idle" };

// Смена пароля из личного кабинета (этап 7): текущий пароль + новый.
export function PasswordForm({ t }: { t: AuthDict }) {
  const [state, action] = useActionState(changePasswordAction, idle);

  if (state.status === "success") {
    return <p className="rounded-2xl bg-emerald-50 px-4 py-3 font-medium text-emerald-900">{t.password.success}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <PasswordField name="currentPassword" label={t.currentPasswordLabel} autoComplete="current-password" t={t} />
      <PasswordField name="password" label={t.newPasswordLabel} hint={t.passwordHint} autoComplete="new-password" t={t} />
      <ErrorNote error={state.status === "error" ? state.error : null} t={t} />
      <SubmitButton label={t.password.submit} t={t} />
    </form>
  );
}
