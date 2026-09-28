import { setLocale } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";

// Переключатель UZ / RU. Обычная форма: работает даже без JavaScript.
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocale} aria-label={label} className="flex rounded-full bg-sand p-1 text-sm font-semibold">
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
              "focus-ring min-w-11 rounded-full px-3 py-1.5 uppercase transition-colors " +
              (active ? "bg-ink text-on-dark" : "text-ink hover:bg-white/70")
            }
          >
            {code}
          </button>
        );
      })}
    </form>
  );
}
