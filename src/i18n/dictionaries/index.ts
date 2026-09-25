import type { Locale } from "../config";
import { ru, type Dictionary } from "./ru";
import { uz } from "./uz";

const dictionaries: Record<Locale, Dictionary> = { uz, ru };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
