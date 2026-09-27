// Готовит из записи Report данные для показа человеку: название уровня, название 16-типа на языке
// интерфейса, стили восприятия текстом, дату. Общее для онлайн-страницы отчёта (ReportView) и PDF
// (src/lib/pdf), чтобы оба места показывали одно и то же одинаково.

import { uzSixteenTypeName } from "@/lib/ai/uz-resources";
import type { ReportContent } from "@/lib/ai/report-schema";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import { isLevel } from "@/lib/payments";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { firstSentences } from "./paragraphs";

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

// Явная строка «на каком языке отчёт» (аудит UX-06) — показывается всегда, на web-странице
// отчёта и в PDF, независимо от того, совпадает ли язык отчёта с текущим языком интерфейса.
// Переключатель языка сайта меняет только оболочку (эти подписи вокруг текста и т. п.);
// содержимое отчёта (report.content) остаётся на report.locale, зафиксированном при оплате.
export function reportLanguageNote(reportLocale: Locale, t: Dictionary): string {
  return fmt(t.report.languageNote, { lang: t.report.languageNames[reportLocale] });
}

export interface ReportFirstScreen {
  // 1–2 предложения — выдержка из уже написанного портрета, а не отдельное поле от ИИ
  // (ТЗ аудита §9: слой отображения над текущей схемой, без изменения генерации).
  takeaway: string;
  direction: string;
  firstStep: string;
  // Время, деньги, что понадобится — из первого варианта маршрута (main_path.routes[0]).
  constraints: string;
}

// Компактный первый экран отчёта (ТЗ аудита §9): вывод, основное направление, первый шаг,
// ограничения — собраны из уже существующих полей ReportContent, ничего нового не генерируется.
export function buildFirstScreen(content: ReportContent): ReportFirstScreen {
  const route = content.main_path.routes[0];
  const constraints = route
    ? [route.time_estimate, route.cost_range, route.requirements[0]].filter(Boolean).join(" · ")
    : "";
  return {
    takeaway: firstSentences(content.portrait.summary, 2),
    direction: content.goal.statement,
    firstStep: content.act_now[0] ?? "",
    constraints,
  };
}
