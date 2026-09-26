import type { NextConfig } from "next";

// Заголовки безопасности (этап 10А). Сайт не грузит ничего с посторонних доменов (ни скриптов,
// ни шрифтов, ни стилей — Tailwind собран в один файл), поэтому CSP может быть строгим.
// 'unsafe-inline' в style-src нужен: React пишет некоторые стили как атрибут style="…", браузеры
// требуют его в style-src отдельно от script-src (там inline не разрешён).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
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
  // Шрифт для PDF-отчёта (src/lib/pdf/fonts.ts) — по той же причине.
  outputFileTracingIncludes: {
    "/**": [
      "./docs/uz-glossary.md",
      "./docs/uz-teaser-examples.md",
      "./src/lib/pdf/fonts/NotoSans-Regular.ttf",
      "./src/lib/pdf/fonts/NotoSans-Bold.ttf",
    ],
  },
};

export default nextConfig;
