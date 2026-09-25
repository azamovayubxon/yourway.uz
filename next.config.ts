import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сборка без привязки к Vercel: `next build && next start` работает на любом сервере с Node.js.
  poweredByHeader: false,
};

export default nextConfig;
