import "server-only";
import { cookies } from "next/headers";
import { getDefaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : getDefaultLocale();
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
