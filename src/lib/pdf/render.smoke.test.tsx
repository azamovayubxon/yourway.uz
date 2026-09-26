import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { MOCK_REPORTS } from "@/lib/ai/mock-reports";
import { mergeReportParts } from "@/lib/ai/report-schema";
import { fmt } from "@/i18n/format";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";
import { registerPdfFonts } from "./fonts";
import { ReportDocument, type ReportPdfProps } from "./ReportDocument";

// render.tsx импортирует "server-only" (страж от случайного импорта в клиентском коде) — vitest
// не эмулирует границу сервер/клиент Next.js, поэтому здесь та же логика без обёртки render.tsx.
async function renderReportPdf(props: ReportPdfProps): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<ReportDocument {...props} />);
}

// Проверяет, что PDF реально собирается (шрифт грузится, вёрстка не падает) на обоих языках.
// ⚠️ styles.page в ReportDocument.tsx намеренно без lineHeight — с ним react-pdf 4.9 молча
// перестаёт печатать динамический текст (номер страницы) в колонтитуле. Если это изменится,
// проверить получившийся PDF глазами (номера страниц внизу).
describe("renderReportPdf smoke test", () => {
  it("renders a RU report without throwing", async () => {
    const mock = MOCK_REPORTS.ru;
    const content = mergeReportParts({
      portrait_goal: { portrait: mock.portrait, goal: mock.goal.stated, reality_check: mock.reality_check.stated },
      main_path: mock.main_path,
      finish: mock.finish,
    });
    const pdf = await renderReportPdf({
      content,
      t: ru.report,
      levelName: ru.checkout.levels.navigator.name,
      sixteenType: "INTP · Логик",
      learningStyles: ["практика", "чтение"],
      date: "25.09.2026",
      mockNote: `${ru.teaser.mockBadge}. ${ru.teaser.mockNote}`,
      languageNote: fmt(ru.report.languageNote, { lang: ru.report.languageNames.ru }),
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("renders a UZ report without throwing", async () => {
    const mock = MOCK_REPORTS.uz;
    const content = mergeReportParts({
      portrait_goal: { portrait: mock.portrait, goal: mock.goal.constructed, reality_check: mock.reality_check.constructed },
      main_path: mock.main_path,
      finish: mock.finish,
    });
    const pdf = await renderReportPdf({
      content,
      t: uz.report,
      levelName: uz.checkout.levels.navigator.name,
      sixteenType: "INTP · Mantiqchi",
      learningStyles: ["qilib koʻrib oʻrganish"],
      date: "25.09.2026",
      mockNote: null,
      languageNote: fmt(uz.report.languageNote, { lang: uz.report.languageNames.ru }),
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
