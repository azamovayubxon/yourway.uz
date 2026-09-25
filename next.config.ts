import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сборка без привязки к Vercel: `next build && next start` работает на любом сервере с Node.js.
  poweredByHeader: false,
  // Узбекский глоссарий и эталонные тексты читаются сервером из docs/ при генерации тизера
  // (src/lib/ai/uz-resources.ts). Явно включаем их в сборку, чтобы они были на сервере.
  outputFileTracingIncludes: {
    "/**": ["./docs/uz-glossary.md", "./docs/uz-teaser-examples.md"],
  },
};

export default nextConfig;
