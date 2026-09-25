import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Header({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-ink">
          your<span className="text-brand-500">way</span>.uz
        </Link>
        <LanguageSwitcher locale={locale} label={t.common.language} />
      </div>
    </header>
  );
}
