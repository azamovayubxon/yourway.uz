// Правила для логина, пароля и кода восстановления (этап 5). Здесь только чистые функции без базы:
// их проверяют автотесты credentials.test.ts.

import { randomInt } from "node:crypto";

// Коды ошибок. Тексты для пользователя — в словарях (auth.errors).
export type CredentialError =
  | "login_invalid"
  | "password_short"
  | "password_long"
  | "password_same_as_login";

export const LOGIN_MIN = 3;
export const LOGIN_MAX = 32;
export const PASSWORD_MIN = 8;
// Верхняя граница — защита от очень длинных строк (хеширование длинного пароля нагружает сервер).
export const PASSWORD_MAX = 128;

// Логин хранится и сравнивается в нижнем регистре: «Aziz» и «aziz» — один и тот же логин.
export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

// Латинские буквы, цифры, «.», «_», «-»; первый символ — буква или цифра. Кириллица не допускается,
// чтобы не было логинов-двойников из похожих букв (латинская «a» и русская «а»).
const LOGIN_RE = new RegExp(`^[a-z0-9][a-z0-9._-]{${LOGIN_MIN - 1},${LOGIN_MAX - 1}}$`);

export function validateLogin(normalized: string): CredentialError | null {
  return LOGIN_RE.test(normalized) ? null : "login_invalid";
}

export function validatePassword(password: string, normalizedLogin: string): CredentialError | null {
  // Длина — в символах Юникода (эмодзи и узбекские буквы считаются за один символ).
  const length = [...password].length;
  if (length < PASSWORD_MIN) return "password_short";
  if (length > PASSWORD_MAX) return "password_long";
  if (password.trim().toLowerCase() === normalizedLogin) return "password_same_as_login";
  return null;
}

// Код восстановления: 16 символов из алфавита Крокфорда (без I, L, O, U — их легко спутать
// с 1 и 0), по 4 через дефис: «7K3F-9QXM-B2RD-TW4H». Это 80 бит случайности — подобрать нельзя.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 16;

export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return formatRecoveryCode(raw);
}

export function formatRecoveryCode(raw: string): string {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

// Код, как его ввёл человек → 16 символов без дефисов, или null, если это не код.
// Прощаем пробелы, дефисы, строчные буквы и путаницу O/0, I/1, L/1.
export function normalizeRecoveryCode(input: string): string | null {
  const raw = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (raw.length !== CODE_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return raw;
}

// Куда вернуть человека после входа (?next=...). Только адреса нашего сайта: «/pricing», но не
// «//evil.com» и не «https://...» — иначе ссылку можно было бы использовать для перенаправления на чужой сайт.
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
