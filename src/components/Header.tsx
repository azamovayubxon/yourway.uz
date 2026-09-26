import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/current";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Шапка: логотип, навигация к разделам главной (десктоп) или компактное меню (мобильный),
// вход в аккаунт (или логин, если человек уже вошёл) и переключатель языка.
// Регистрацию здесь не предлагаем: она появляется только перед оплатой. «Войти» нужно тем,
// у кого аккаунт уже есть (например, с другого телефона).
export function Header({ locale, t, user }: { locale: Locale; t: Dictionary; user: CurrentUser | null }) {
  const navLinks = [
    { href: "/#how", label: t.header.how },
    { href: "/#sample", label: t.header.sample },
    { href: "/#pricing", label: t.header.pricing },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="focus-ring shrink-0 rounded text-lg font-extrabold tracking-tight text-ink">
            your<span className="text-brand-500">way</span>.uz
          </Link>
          {/* Навигация к разделам главной — только на десктопе (ТЗ аудита §4). */}
          <nav className="hidden items-center gap-4 text-sm font-semibold text-ink/80 sm:flex">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="focus-ring rounded py-2 hover:text-brand-600">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={user ? "/account" : "/login"}
            aria-label={user ? t.common.account : undefined}
            className="focus-ring flex min-h-11 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink/80 hover:text-ink"
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
          {/* Мобильное компактное меню: те же ссылки, что и в десктопной навигации. */}
          <details className="relative sm:hidden">
            <summary
              aria-label={t.header.menu}
              className="focus-ring flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-ink/80"
            >
              <MenuIcon />
            </summary>
            <nav className="absolute right-0 top-full mt-1 flex w-44 flex-col gap-1 rounded-2xl border border-line bg-white p-2 text-sm font-semibold text-ink shadow-lg">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="focus-ring rounded-lg px-3 py-2.5 hover:bg-app-bg">
                  {l.label}
                </Link>
              ))}
            </nav>
          </details>
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 shrink-0" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
