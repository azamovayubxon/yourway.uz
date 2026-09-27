"use client";

import { usePathname } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { Footer } from "./Footer";

// Внутри прохождения теста/опроса показываем сокращённый footer (ТЗ аудита §6, п. 3).
// Определяем это по пути, а не по флагу с сервера: раскладка общая для всех страниц.
export function FooterGate({ t }: { t: Dictionary }) {
  const pathname = usePathname();
  const compact = pathname?.startsWith("/test") || pathname?.startsWith("/survey");
  return <Footer t={t} compact={compact} />;
}
