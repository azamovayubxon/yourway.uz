import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { ReportDocument, type ReportPdfProps } from "./ReportDocument";

// Рендер PDF полного отчёта в Buffer. renderToBuffer — синхронная (в рамках одного запроса) генерация
// без headless-браузера: быстро и укладывается в лимиты времени хостинга (CLAUDE.md §3, переносимость).
export async function renderReportPdf(props: ReportPdfProps): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<ReportDocument {...props} />);
}
