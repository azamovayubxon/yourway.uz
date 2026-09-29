import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReportContent } from "@/lib/ai/report-schema";
import { getCurrentUser } from "@/lib/auth";
import { REPORT_PARTS } from "@/lib/ai/prompts";
import { getUserReport } from "@/lib/report";
import { presentReport, reportLanguageNote, reportLanguageShort, reportTypeLabel } from "@/lib/report/present";
import { partsDone } from "@/lib/report/progress";
import type { Locale } from "@/i18n/config";
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

  const reportLocale = report.locale as Locale;
  const presentation = presentReport(report, locale, t);
  const content = report.content as unknown as ReportContent;

  return (
    <ReportView
      id={report.id}
      t={t.report}
      content={content}
      typeLabel={reportTypeLabel({ teaser: report.teaser, content, locale: report.locale })}
      reportLocale={reportLocale}
      levelName={presentation.levelName}
      sixteenType={presentation.sixteenType}
      learningStyles={presentation.learningStyles}
      date={presentation.date}
      mockBadge={mockBadge}
      languageNote={reportLanguageNote(reportLocale, t)}
      languageShort={reportLanguageShort(reportLocale, t)}
      footer={
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 print:hidden sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href={`/api/report/${report.id}/pdf`}
            className="focus-ring inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-ink px-6 font-bold text-on-dark hover:bg-ink/90"
          >
            {t.report.downloadPdf} ↓
          </a>
          <Link
            href="/account"
            className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full border-2 border-line bg-white px-6 font-bold text-ink hover:border-brand-500"
          >
            {t.report.backToAccount}
          </Link>
          <Link href="/start?new=1" className="focus-ring inline-flex min-h-11 items-center justify-center rounded text-sm font-semibold text-muted underline hover:text-ink">
            {t.report.retake}
          </Link>
        </div>
      }
    />
  );
}
