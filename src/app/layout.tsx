import type { Metadata, Viewport } from "next";
import { Commissioner, Onest } from "next/font/google";
import type { ReactNode } from "react";
import { FooterGate } from "@/components/FooterGate";
import { Header } from "@/components/Header";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current";
import { logError } from "@/lib/monitoring";
import { getI18n } from "@/i18n/server";
import "./globals.css";

// Фирменные шрифты (CLAUDE.md, раздел «Дизайн»): Commissioner — заголовки, Onest — текст.
// next/font скачивает файлы при сборке и раздаёт их с нашего же домена (браузер к Google не ходит,
// CSP не меняется). Оба шрифта «переменные» (variable): один файл на подмножество содержит все
// начертания, поэтому отдельный список весов не нужен и не уменьшает загрузку.
// Самохостятся все подмножества (latin, latin-ext, cyrillic и др.), браузер скачивает только те,
// чьи символы есть на странице (unicode-range). Заранее (preload) грузим только latin: в нём
// весь узбекский текст, включая oʻ gʻ (U+02BB) и ʼ (U+02BC). Кириллица подгружается на русских
// страницах сама — так узбекская главная не тянет лишние ~40 КБ.
const onest = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-onest",
});
const commissioner = Commissioner({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-commissioner",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  // APP_URL — адрес сайта (этап 10Б), нужен как база для абсолютных ссылок (сейчас — только
  // metadataBase; появятся PDF-ссылки, OG-картинки и т. п. — тоже будут строиться от неё).
  const appUrl = process.env.APP_URL;
  return {
    title: t.meta.title,
    description: t.meta.description,
    metadataBase: appUrl ? new URL(appUrl) : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf7f0",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getI18n();
  // Если база недоступна, сайт всё равно открывается (просто без имени пользователя в шапке).
  let user: CurrentUser | null = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    await logError("auth-header", e);
  }
  return (
    <html lang={locale} className={`${onest.variable} ${commissioner.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {/* Для людей, кто работает с клавиатуры: перепрыгнуть шапку и сразу попасть в содержимое (этап 10Г). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          {t.common.skipToContent}
        </a>
        <Header locale={locale} t={t} user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <FooterGate t={t} />
      </body>
    </html>
  );
}
