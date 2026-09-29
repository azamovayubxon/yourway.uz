import type { NextConfig } from "next";

// Заголовки безопасности (этап 10А). Content-Security-Policy сюда больше не входит: ей нужен
// нонс на каждый запрос (иначе она блокирует встроенные скрипты гидратации Next.js — см. срочный
// фикс сентября 2026, когда сайт грузился, но ни одна кнопка не работала). CSP теперь генерируется
// в `src/proxy.ts` (Proxy — новое имя Middleware в Next 16) заново на каждый запрос.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS. На обычном сервере HTTPS обычно завершается на nginx (см. docs/deploy-server.md),
  // заголовок всё равно можно отдавать — браузер применяет его только к https-ответам.
  // Без "preload": владелец планирует переезд между хостингами (см. этап 10Б), а preload
  // регистрируется в браузерах на месяцы вперёд и его почти невозможно отменить быстро —
  // если на новом хостинге на какое-то время не будет HTTPS, домен станет недоступен всем,
  // у кого браузер уже запомнил preload. Без него можно просто убрать заголовок.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Сборка без привязки к Vercel: `next build && next start` работает на любом сервере с Node.js.
  poweredByHeader: false,
  // "standalone": сборка сама собирает нужные файлы node_modules в .next/standalone — так Docker-образ
  // (Dockerfile в корне) получается маленьким и не тащит в контейнер весь node_modules и исходники.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Узбекский глоссарий и эталонные тексты читаются сервером из docs/ при генерации тизера
  // (src/lib/ai/uz-resources.ts). Явно включаем их в сборку, чтобы они были на сервере.
  // Шрифт для PDF-отчёта (src/lib/pdf/fonts.ts) и картинок «Поделиться» (src/lib/og) — по той же причине.
  outputFileTracingIncludes: {
    "/**": [
      "./docs/uz-glossary.md",
      "./docs/uz-teaser-examples.md",
      "./src/lib/pdf/fonts/NotoSans-Regular.ttf",
      "./src/lib/pdf/fonts/NotoSans-Bold.ttf",
      // Шрифты картинок «Поделиться» (src/lib/og, next/og читает только ttf/otf/woff).
      "./src/lib/og/fonts/Commissioner-ExtraBold.ttf",
      "./src/lib/og/fonts/Onest-Regular.ttf",
      "./src/lib/og/fonts/Onest-Bold.ttf",
    ],
  },
};

export default nextConfig;
