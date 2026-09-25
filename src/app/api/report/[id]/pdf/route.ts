import type { ReportContent } from "@/lib/ai/report-schema";
import { getCurrentUser } from "@/lib/auth";
import { getUserReport } from "@/lib/report";
import { presentReport } from "@/lib/report/present";
import { renderReportPdf } from "@/lib/pdf/render";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { logPdfDownload } from "@/lib/admin/funnel";
import { getSessionIdFromCookie } from "@/lib/session";

// Скачивание PDF готового отчёта: GET /api/report/<id>/pdf. Доступен только владельцу аккаунта
// (как и сама страница отчёта); чужой, несуществующий или ещё не готовый отчёт — 404.
export const dynamic = "force-dynamic";
// Рендер PDF без headless-браузера — обычно доли секунды; лимит с запасом.
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const report = await getUserReport((await params).id, user.id);
  if (!report || report.status !== "ready" || !report.content) return new Response("not found", { status: 404 });

  const { locale, t } = await getI18n();
  const presentation = presentReport(report, locale, t);
  const mockNote = report.aiMode === "mock" ? `${t.teaser.mockBadge}. ${t.teaser.mockNote}` : null;
  const reportLocale = report.locale as Locale;
  const otherLanguage =
    reportLocale !== locale ? fmt(t.report.otherLanguage, { lang: t.report.languageNames[reportLocale] }) : null;

  const pdf = await renderReportPdf({
    content: report.content as unknown as ReportContent,
    t: t.report,
    levelName: presentation.levelName,
    sixteenType: presentation.sixteenType,
    learningStyles: presentation.learningStyles,
    date: presentation.date,
    mockNote,
    otherLanguage,
  });

  await logPdfDownload(report.locale as Locale, await getSessionIdFromCookie());

  const filename = pdfFileName(report.level, report.locale as Locale, report.createdAt);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}

// Имя файла — латиницей и цифрами (кириллица в filename= ломается у части почтовых клиентов
// и мессенджеров; filename* с кодировкой выше даёт красивое имя там, где оно поддерживается).
function pdfFileName(level: string, locale: Locale, createdAt: Date): string {
  const date = createdAt.toISOString().slice(0, 10);
  return `yourway-${level}-${locale}-${date}.pdf`;
}
