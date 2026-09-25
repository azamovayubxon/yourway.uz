"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import type { AuthFormState } from "@/app/account/actions";

// Поля и кнопки форм аккаунта. Крупные (под палец), шрифт 16px — чтобы iPhone не увеличивал страницу.

type AuthDict = Dictionary["auth"];

const inputClass =
  "block min-h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base outline-none transition-colors focus:border-brand-500";

export function TextField({
  name,
  label,
  hint,
  defaultValue,
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        required
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({
  label,
  hint,
  autoComplete,
  t,
}: {
  label: string;
  hint?: string;
  autoComplete: "current-password" | "new-password";
  t: AuthDict;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={inputClass + " pr-14"}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.hidePassword : t.showPassword}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink"
        >
          <EyeIcon crossed={visible} />
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ label, t }: { label: string; t: AuthDict }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
    >
      {pending ? t.sending : label}
    </button>
  );
}

export function FormError({ state, t }: { state: AuthFormState; t: AuthDict }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
      {fmt(t.errors[state.error], { min: state.minutes ?? 15 })}
    </p>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 20 20 4" strokeLinecap="round" />}
    </svg>
  );
}
