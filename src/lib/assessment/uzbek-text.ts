// Нормализация узбекских апострофов (решение (Б) в CLAUDE.md).
//
// В JSON-файлах тестов вместо узбекских знаков стоит обычный апостроф `'`.
// Файлы не меняем, а исправляем текст при загрузке, и только в узбекских полях:
//   o' g' O' G'                → oʻ gʻ Oʻ Gʻ   (U+02BB, «oʻ», «gʻ»)
//   остальные апострофы в слове → ʼ            (U+02BC, «taʼlim», «maʼno»)
//   одинарные кавычки вокруг слова ('sovuq') остаются как есть.

const OKINA = "ʻ"; // ʻ
const TUTUQ = "ʼ"; // ʼ

const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch);

export function normalizeUzApostrophes(text: string): string {
  const chars = [...text];
  let quoteOpen = false; // внутри ли мы 'кавычек'
  const out: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch !== "'") {
      out.push(ch);
      continue;
    }
    const prev = chars[i - 1];
    const next = chars[i + 1];

    // Перед апострофом не буква, после — буква: открывающая кавычка ('sovuq).
    if (!isLetter(prev) && isLetter(next)) {
      quoteOpen = true;
      out.push(ch);
      continue;
    }
    // Не буква с обеих сторон: это не знак внутри слова, не трогаем.
    if (!isLetter(prev)) {
      out.push(ch);
      continue;
    }
    // После буквы, а дальше конец слова: либо закрывающая кавычка, либо «mablagʻ».
    if (!isLetter(next) && quoteOpen) {
      quoteOpen = false;
      out.push(ch);
      continue;
    }
    // oʻ / gʻ — и внутри слова (koʻp), и в конце слова (mablagʻ).
    if (/[oOgG]/.test(prev)) {
      out.push(OKINA);
      continue;
    }
    // Остальные апострофы между буквами: taʼlim, maʼno, eʼtirof.
    out.push(isLetter(next) ? TUTUQ : ch);
  }
  return out.join("");
}

// Узбекское ли это поле: `uz`, `text_uz`, `label_uz`, `nickname_uz_lat` и т. п.
export function isUzKey(key: string): boolean {
  return key === "uz" || key.endsWith("_uz") || key.includes("_uz_");
}

// Проходит по всему объекту и нормализует строки в узбекских полях (включая списки строк).
export function normalizeUzFields<T>(value: T, uzField = false): T {
  if (typeof value === "string") {
    return (uzField ? normalizeUzApostrophes(value) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUzFields(item, uzField)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = normalizeUzFields(child, uzField || isUzKey(key));
    }
    return out as T;
  }
  return value;
}
