// Шрифт для PDF-отчёта (этап 7). Noto Sans: покрывает кириллицу и узбекскую латиницу, включая
// oʻ gʻ и апостроф ʼ (U+02BB/U+02BC, решение (Б)) — обычные системные шрифты сайта для PDF не годятся,
// в PDF нужно встраивать шрифт явно. Файлы лежат в этой папке и включены в сборку через
// outputFileTracingIncludes (next.config.ts) — так же, как узбекский глоссарий (src/lib/ai/uz-resources.ts).

import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "Noto Sans";
export const PDF_FONT_REGULAR_FILE = "src/lib/pdf/fonts/NotoSans-Regular.ttf";
export const PDF_FONT_BOLD_FILE = "src/lib/pdf/fonts/NotoSans-Bold.ttf";

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(process.cwd(), PDF_FONT_REGULAR_FILE), fontWeight: "normal" },
      { src: path.join(process.cwd(), PDF_FONT_BOLD_FILE), fontWeight: "bold" },
    ],
  });
  // Движок переносов не знает правил русского и узбекского языков и ломает слова некрасиво —
  // отключаем перенос по слогам, слова переносятся только по пробелу.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
