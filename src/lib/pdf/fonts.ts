// Шрифты PDF-отчёта (этап 7; новый стиль — этап 3). Заголовки — Commissioner ExtraBold, текст —
// Onest Regular/Bold: те же статичные TTF, что у картинок «Поделиться» (src/lib/og/fonts, файлы
// не дублируются). В них есть кириллица и узбекские ʻ (U+02BB) и ʼ (U+02BC) — проверка по самому
// PDF: src/lib/pdf/render.smoke.test.tsx. Noto Sans — только запасной шрифт на случай редкого
// знака, которого нет в Onest (react-pdf иначе молча выкидывает такой знак из текста). Все файлы
// включены в сборку через outputFileTracingIncludes (next.config.ts).

import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { OG_FONT_FILES } from "@/lib/og/fonts";

export const PDF_FONT_BODY = "Onest";
export const PDF_FONT_DISPLAY = "Commissioner";
export const PDF_FONT_FALLBACK = "Noto Sans";
export const PDF_FONT_REGULAR_FILE = "src/lib/pdf/fonts/NotoSans-Regular.ttf";
export const PDF_FONT_BOLD_FILE = "src/lib/pdf/fonts/NotoSans-Bold.ttf";

// Цепочки шрифтов для стилей: знак берётся из первого шрифта, где он есть.
export const PDF_BODY_FONTS = [PDF_FONT_BODY, PDF_FONT_FALLBACK];
export const PDF_DISPLAY_FONTS = [PDF_FONT_DISPLAY, PDF_FONT_BODY, PDF_FONT_FALLBACK];
// Commissioner зарегистрирован только в начертании 800 — заголовки задают именно его.
export const PDF_DISPLAY_WEIGHT = 800;

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  const file = (f: string) => path.join(process.cwd(), f);
  Font.register({
    family: PDF_FONT_BODY,
    fonts: [
      { src: file(OG_FONT_FILES.regular), fontWeight: 400 },
      { src: file(OG_FONT_FILES.bold), fontWeight: 700 },
    ],
  });
  Font.register({
    family: PDF_FONT_DISPLAY,
    fonts: [{ src: file(OG_FONT_FILES.display), fontWeight: PDF_DISPLAY_WEIGHT }],
  });
  Font.register({
    family: PDF_FONT_FALLBACK,
    fonts: [
      { src: file(PDF_FONT_REGULAR_FILE), fontWeight: 400 },
      { src: file(PDF_FONT_BOLD_FILE), fontWeight: 700 },
    ],
  });
  // Движок переносов не знает правил русского и узбекского языков и ломает слова некрасиво —
  // отключаем перенос по слогам, слова переносятся только по пробелу.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
