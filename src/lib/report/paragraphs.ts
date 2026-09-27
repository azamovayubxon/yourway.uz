// Разбивка длинных абзацев при отображении (ТЗ аудита §9: «абзац — одна мысль, ориентир
// 40–80 слов»). Схему генерации и сам текст не меняем — это только слой отображения:
// берём уже написанный текст ИИ и показываем его на экране частями поудобнее для чтения.
//
// Первый уровень разбивки — переносы строк, которые уже расставил ИИ (whitespace-pre-line
// раньше показывал их как есть). Внутри каждого такого блока, если он длиннее лимита слов,
// делим дальше по границам предложений — так мысль не обрывается посередине.

const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+(?=[A-ZЁА-Я0-9«"'])/;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitBlock(block: string, maxWords: number): string[] {
  if (wordCount(block) <= maxWords) return [block];
  const sentences = block.split(SENTENCE_BOUNDARY).filter((s) => s.trim() !== "");
  if (sentences.length <= 1) return [block];

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const sentence of sentences) {
    const n = wordCount(sentence);
    if (current.length > 0 && currentWords + n > maxWords) {
      paragraphs.push(current.join(" "));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += n;
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs;
}

// Возвращает готовые абзацы для рендера (каждый — свой <p>). maxWords — ориентир из ТЗ (40–80);
// по умолчанию верхняя граница, чтобы делить только по-настоящему длинные блоки.
export function splitIntoParagraphs(text: string, maxWords = 80): string[] {
  const blocks = text.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.flatMap((block) => splitBlock(block, maxWords));
}

// Первые n предложений текста — для компактного «краткого вывода» на первом экране отчёта
// (ТЗ аудита §9): не отдельное поле от ИИ, а выдержка из уже написанного портрета.
export function firstSentences(text: string, n: number): string {
  const first = text.split(/\n+/)[0]?.trim() ?? "";
  const sentences = first.split(SENTENCE_BOUNDARY).filter((s) => s.trim() !== "");
  return sentences.slice(0, n).join(" ");
}
