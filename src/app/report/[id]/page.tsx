import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReportContent } from "@/lib/ai/report-schema";
import { uzSixteenTypeName } from "@/lib/ai/uz-resources";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import { getCurrentUser } from "@/lib/auth";
import { devToolsEnabled } from "@/lib/dev";
import { isLevel } from "@/lib/payments";
import { REPORT_PARTS } from "@/lib/ai/prompts";
import { getUserReport } from "@/lib/report";
import { partsDone } from "@/lib/report/progress";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { ReportGenerator } from "./ReportGenerator";
import { ReportView } from "./ReportView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Полный отчёт. Открыть его может только владелец аккаунта, который его оплатил: без входа —
// на страницу входа, чужой или несуществующий отчёт — 404. Отчёт создаётся только после оплаты,
// поэтому «без оплаты по прямой ссылке» открыть нечего.
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/report/${id}`);
  const report = await getUserReport(id, user.id);
  if (!report) notFound();

  const { locale, t } = await getI18n();
  const mockBadge = report.aiMode === "mock" ? { label: t.teaser.mockBadge, note: t.teaser.mockNote } : null;

  if (report.status !== "ready" || !report.content) {
    const parts = (report.parts ?? {}) as Record<string, unknown>;
    return (
      <ReportGenerator
        reportId={report.id}
        t={t.report}
        mockBadge={mockBadge}
        initial={{
          status: report.status === "failed" ? "failed" : "generating",
          done: partsDone(parts),
          total: REPORT_PARTS.length,
        }}
      />
    );
  }

  const profile = report.profile as unknown as Profile;
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
  const reportLocale = report.locale as Locale;

  return (
    <ReportView
      id={report.id}
      t={t.report}
      content={report.content as unknown as ReportContent}
      reportLocale={reportLocale}
      levelName={isLevel(report.level) ? t.checkout.levels[report.level].name : report.level}
      sixteenType={`${code} · ${typeName}`}
      learningStyles={learningStyles}
      date={date}
      mockBadge={mockBadge}
      otherLanguage={
        reportLocale !== locale ? fmt(t.report.otherLanguage, { lang: t.report.languageNames[reportLocale] }) : null
      }
      footer={
        <div className="mt-10 flex flex-col items-center gap-1 text-center print:hidden">
          <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
            {t.report.backToAccount} →
          </Link>
          <Link href="/start?new=1" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted underline">
            {t.report.retake}
          </Link>
          {devToolsEnabled() && (
            <Link href="/dev/ai-log" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600">
              {t.teaser.devAiLogLink} →
            </Link>
          )}
        </div>
      }
    />
  );
}
