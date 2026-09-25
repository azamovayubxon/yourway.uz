import { setLocale } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";

// Переключатель UZ / RU. Обычная форма: работает даже без JavaScript.
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocale} aria-label={label} className="flex rounded-full bg-slate-100 p-1 text-sm font-semibold">
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="submit"
            name="locale"
            value={code}
            aria-pressed={active}
            className={
              "min-w-11 rounded-full px-3 py-1.5 uppercase transition-colors " +
              (active ? "bg-white text-brand-600 shadow-sm" : "text-muted hover:text-ink")
            }
          >
            {code}
          </button>
        );
      })}
    </form>
  );
}
