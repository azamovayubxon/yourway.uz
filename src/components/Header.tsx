import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/current";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Шапка: логотип, вход в аккаунт (или логин, если человек уже вошёл) и переключатель языка.
// Регистрацию здесь не предлагаем: она появляется только перед оплатой. «Войти» нужно тем,
// у кого аккаунт уже есть (например, с другого телефона).
export function Header({ locale, t, user }: { locale: Locale; t: Dictionary; user: CurrentUser | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-tight text-ink">
          your<span className="text-brand-500">way</span>.uz
        </Link>
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? t.common.account : undefined}
            className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink/80 hover:text-ink"
          >
            {user ? (
              <>
                <UserIcon />
                <span className="max-w-[5.5rem] truncate">{user.login}</span>
              </>
            ) : (
              t.common.login
            )}
          </Link>
          <LanguageSwitcher locale={locale} label={t.common.language} />
        </div>
      </div>
    </header>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 shrink-0 text-brand-500" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.5-4 4.5-5.5 8-5.5s6.5 1.5 8 5.5" strokeLinecap="round" />
    </svg>
  );
}
