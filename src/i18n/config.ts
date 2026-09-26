export const LOCALES = ["uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "locale";
// Сколько помнить выбранный язык: 1 год.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Язык по умолчанию берётся из переменной окружения DEFAULT_LOCALE (по умолчанию `uz`).
export function getDefaultLocale(): Locale {
  const fromEnv = process.env.DEFAULT_LOCALE;
  return isLocale(fromEnv) ? fromEnv : "uz";
}

// Язык полного отчёта (аудит UX-06): явный выбор на checkout, а не язык интерфейса на момент
// оплаты. Значение из формы может отсутствовать (например, JS отключён и скрытое поле не пришло)
// или быть повреждено — тогда откатываемся на язык интерфейса, как было раньше этого решения.
export function resolveReportLocale(formValue: unknown, interfaceLocale: Locale): Locale {
  return isLocale(formValue) ? formValue : interfaceLocale;
}
