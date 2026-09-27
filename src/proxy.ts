import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Content-Security-Policy с нонсом (срочный фикс, сентябрь 2026). Раньше CSP лежала в
// next.config.ts статической строкой (`script-src 'self'`, без нонса) — на боевой сборке это
// блокировало встроенные скрипты гидратации Next.js (self.__next_f.push и т. п.), поэтому сайт
// открывался, но ни одна кнопка не работала: ни ответ на вопрос теста, ни вход, ни checkout.
//
// Нонс — одноразовая случайная строка на каждый запрос. Next.js сам читает её из заголовка
// Content-Security-Policy запроса и подставляет во все свои скрипты (фреймворк, код страницы,
// инлайн-гидратацию), поэтому вручную помечать теги не нужно (App Router).
//
// 'unsafe-inline' для script-src не используем. Для style-src оставляем 'unsafe-inline' как было
// в next.config.ts (минимально необходимое): React пишет часть стилей как атрибут style="…"
// (например, ширину прогресс-бара в тесте), а такие атрибуты нонс не покрывает. Если добавить
// нонс и в style-src, браузер по спеке CSP перестанет учитывать 'unsafe-inline' в этой директиве
// (нонс/хэш отключают unsafe-inline), и эти атрибуты сломаются. Поэтому style-src — без нонса.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // На запрос — чтобы Next.js увидел нонс при рендере (headers()/App Router читают именно это).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // На ответ — чтобы её увидел браузер.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Нонс должен быть новым на каждый показ страницы, поэтому Proxy должен видеть обычные переходы.
// Префетчи next/link (заголовок next-router-prefetch) и статику/оптимизированные картинки Next.js
// пропускаем — там CSP ни на что не влияет, а рендерить страницу заново ради нонса не нужно.
export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
