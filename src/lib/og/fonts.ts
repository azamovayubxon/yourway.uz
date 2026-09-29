// Файлы шрифтов картинок «Поделиться» (src/lib/og/share-images.tsx): статичные TTF из Google Fonts.
// Satori (next/og) не читает woff2 и переменные шрифты, поэтому это не те файлы, что next/font
// раздаёт сайту. Проверка ʻ ʼ и кириллицы — src/lib/og/fonts.test.ts.
export const OG_FONT_FILES = {
  display: "src/lib/og/fonts/Commissioner-ExtraBold.ttf",
  regular: "src/lib/og/fonts/Onest-Regular.ttf",
  bold: "src/lib/og/fonts/Onest-Bold.ttf",
} as const;
