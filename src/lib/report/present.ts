// Готовит из записи Report данные для показа человеку: название уровня, название 16-типа на языке
// интерфейса, стили восприятия текстом, дату. Общее для онлайн-страницы отчёта (ReportView) и PDF
// (src/lib/pdf), чтобы оба места показывали одно и то же одинаково.

import { uzSixteenTypeName } from "@/lib/ai/uz-resources";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import { isLevel } from "@/lib/payments";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export interface ReportPresentation {
  levelName: string;
  sixteenType: string;
  learningStyles: string[];
  date: string;
}

export function presentReport(
  report: { level: string; createdAt: Date; profile: unknown },
  locale: Locale,
  t: Dictionary,
): ReportPresentation {
  const profile = report.profile as Profile;
  const code = profile.sixteen_type.code;
  // 16-тип — на языке интерфейса (как в тизере, решение (И)); узбекское название — из глоссария.
  const typeName =
    (locale === "uz" ? uzSixteenTypeName(code) : undefined) ?? SIXTEEN_TYPES[code]?.[locale] ?? profile.sixteen_type.nickname;
  const styles = Array.isArray(profile.learning_style) ? profile.learning_style : [profile.learning_style];
  const learningStyles = styles
    .map((s) => t.report.learningStyles[s as keyof typeof t.report.learningStyles])
    .filter(Boolean);
  const date = report.createdAt.toLocaleDateString(locale === "uz" ? "uz-Latn-UZ" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  });
  return {
    levelName: isLevel(report.level) ? t.checkout.levels[report.level].name : report.level,
    sixteenType: `${code} · ${typeName}`,
    learningStyles,
    date,
  };
}
