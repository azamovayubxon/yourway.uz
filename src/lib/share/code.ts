// Код ссылки «Поделиться» (/t/[code], этап 2б) и снимок того, что попадает на открытую страницу.
// Чистые функции без базы — их проверяет src/lib/share/code.test.ts.

import { randomInt } from "node:crypto";
import type { TeaserContent } from "@/lib/ai/teaser-schema";

// Без двусмысленных знаков: нет 0/o, 1/l/i — код можно продиктовать и переписать с экрана.
export const SHARE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SHARE_CODE_LENGTH = 12; // 31^12 ≈ 7.9·10^17 вариантов — перебором не найти

export function generateShareCode(): string {
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) code += SHARE_ALPHABET[randomInt(SHARE_ALPHABET.length)];
  return code;
}

const CODE_RE = new RegExp(`^[${SHARE_ALPHABET}]{${SHARE_CODE_LENGTH}}$`);

// Всё, что не похоже на код, отбрасываем сразу, не обращаясь к базе.
export function isShareCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

export interface ShareSnapshot {
  typeLabel: string;
  strengths: string[];
}

// Решение владельца: по ссылке видно ТОЛЬКО название типа и три сильные стороны. Здесь явно
// берутся только эти два поля — портрет, направления, бесплатный шаг, загадка и 16-тип на
// открытую страницу не попадают, даже если схема тизера когда-нибудь расширится.
export function shareSnapshot(content: Pick<TeaserContent, "personality_type_label" | "top_strengths">): ShareSnapshot {
  return {
    typeLabel: content.personality_type_label,
    strengths: content.top_strengths.slice(0, 3),
  };
}

// strengths хранится в базе как JSON — читаем осторожно (только строки, не больше трёх).
export function readStrengths(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string").slice(0, 3) : [];
}
