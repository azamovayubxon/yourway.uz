"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, recoverAction, registerAction, type AuthFormState } from "@/app/account/actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { FormError, PasswordField, SubmitButton, TextField } from "./fields";
import { RecoveryCodeCard } from "./RecoveryCodeCard";

type AuthDict = Dictionary["auth"];
const idle: AuthFormState = { status: "idle" };

// Ссылка вида «/login?next=/pricing»: сохраняем, куда вернуть человека после входа.
function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

const linkClass = "font-semibold text-brand-600";

// Регистрация: только логин и пароль. После успеха на месте формы — код восстановления.
// `already` — логин, если человек уже вошёл (тогда вместо формы — короткое сообщение).
export function RegisterForm({
  t,
  next,
  already,
  keepResults,
  terms,
}: {
  t: AuthDict;
  next: string | null;
  already: string | null;
  keepResults: boolean;
  terms: { offer: string; privacy: string };
}) {
  const [state, action] = useActionState(registerAction, idle);

  if (state.status === "code") {
    return <RecoveryCodeCard t={t} login={state.login} code={state.recoveryCode} next={state.next} />;
  }
  if (already) {
    return (
      <p>
        {fmt(t.register.already, { login: already })}{" "}
        <Link href={next ?? "/account"} className={linkClass}>
          {t.code.continue} →
        </Link>
      </p>
    );
  }

  const loginValue = state.status === "error" ? state.login : "";
  return (
    <div className="space-y-5">
      <p className="text-muted">{t.register.subtitle}</p>
      {keepResults && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">✓ {t.register.keepResults}</p>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <TextField name="login" label={t.loginLabel} hint={t.loginHint} defaultValue={loginValue} autoComplete="username" />
        <PasswordField label={t.passwordLabel} hint={t.passwordHint} autoComplete="new-password" t={t} />
        <FormError state={state} t={t} />
        <SubmitButton label={t.register.submit} t={t} />
        <p className="text-sm text-muted">
          {t.register.terms}{" "}
          <Link href="/offer" className="underline">
            {terms.offer}
          </Link>
          {", "}
          <Link href="/privacy" className="underline">
            {terms.privacy}
          </Link>
          .
        </p>
      </form>
      <p>
        {t.register.haveAccount}{" "}
        <Link href={withNext("/login", next)} className={linkClass}>
          {t.register.toLogin}
        </Link>
      </p>
    </div>
  );
}

export function LoginForm({ t, next }: { t: AuthDict; next: string | null }) {
  const [state, action] = useActionState(loginAction, idle);
  const loginValue = state.status === "error" ? state.login : "";
  return (
    <div className="space-y-5">
      <p className="text-muted">{t.login.subtitle}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <TextField name="login" label={t.loginLabel} defaultValue={loginValue} autoComplete="username" />
        <PasswordField label={t.passwordLabel} autoComplete="current-password" t={t} />
        <FormError state={state} t={t} />
        <SubmitButton label={t.login.submit} t={t} />
      </form>
      <div className="space-y-1">
        <Link href={withNext("/recover", next)} className={"inline-flex min-h-11 items-center " + linkClass}>
          {t.login.forgot}
        </Link>
        <p>
          {t.login.noAccount}{" "}
          <Link href={withNext("/register", next)} className={linkClass}>
            {t.login.toRegister}
          </Link>
        </p>
      </div>
    </div>
  );
}

// Восстановление: логин + код + новый пароль. После успеха — новый код восстановления.
export function RecoverForm({ t, next, already }: { t: AuthDict; next: string | null; already: string | null }) {
  const [state, action] = useActionState(recoverAction, idle);

  if (state.status === "code") {
    return (
      <RecoveryCodeCard t={t} login={state.login} code={state.recoveryCode} next={state.next} note={t.recover.done} />
    );
  }
  if (already) {
    return (
      <p>
        {fmt(t.register.already, { login: already })}{" "}
        <Link href="/account" className={linkClass}>
          {t.code.continue} →
        </Link>
      </p>
    );
  }

  const loginValue = state.status === "error" ? state.login : "";
  return (
    <div className="space-y-5">
      <p className="text-muted">{t.recover.subtitle}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <TextField name="login" label={t.loginLabel} defaultValue={loginValue} autoComplete="username" />
        <TextField name="code" label={t.recover.codeLabel} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" />
        <PasswordField label={t.newPasswordLabel} hint={t.passwordHint} autoComplete="new-password" t={t} />
        <FormError state={state} t={t} />
        <SubmitButton label={t.recover.submit} t={t} />
      </form>
      <p className="text-sm text-muted">{t.recover.lost}</p>
      <Link href={withNext("/login", next)} className={"inline-flex min-h-11 items-center " + linkClass}>
        ← {t.recover.backToLogin}
      </Link>
    </div>
  );
}
