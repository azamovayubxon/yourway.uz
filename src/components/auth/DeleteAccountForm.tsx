"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction, type DeleteAccountFormState } from "@/app/account/actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { ErrorNote, PasswordField } from "./fields";

type AuthDict = Dictionary["auth"];
const idle: DeleteAccountFormState = { status: "idle" };

// Удаление аккаунта (этап 7): пароль для подтверждения + осознанный чекбокс — необратимое действие.
export function DeleteAccountForm({ t }: { t: AuthDict }) {
  const [state, action] = useActionState(deleteAccountAction, idle);
  const [confirmed, setConfirmed] = useState(false);
  const checkboxId = useId();

  return (
    <form action={action} className="space-y-4">
      <PasswordField label={t.deleteAccount.passwordLabel} autoComplete="current-password" t={t} />
      <label htmlFor={checkboxId} className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 p-4">
        <input
          id={checkboxId}
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-rose-600"
        />
        <span className="font-medium">{t.deleteAccount.confirmLabel}</span>
      </label>
      <ErrorNote error={state.status === "error" ? state.error : null} t={t} />
      <DeleteButton label={t.deleteAccount.submit} disabled={!confirmed} />
    </form>
  );
}

function DeleteButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-rose-600 px-6 text-base font-bold text-white shadow-lg shadow-rose-600/25 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}
