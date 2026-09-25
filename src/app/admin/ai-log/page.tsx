import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { reportStatusOf } from "@/lib/report";
import { summarizeReportCalls } from "@/lib/report/ai-log";
import { summarizeTeaserDurations } from "@/lib/teaser/ai-log";
import { AdminShell, Card, DataTable } from "../ui";

export const metadata: Metadata = { robots: { index: false } };

const LIST_SIZE = 30;
const SUMMARY_TEASERS = 20;
const SUMMARY_REPORTS = 20;
const LEVEL_NAMES: Record<string, string> = { route: "Маршрут", navigator: "Навигатор" };
const LOCALE_NAMES: Record<string, string> = { uz: "узбекский", ru: "русский" };
const seconds = (ms: number) => (ms / 1000).toFixed(1);

// Себестоимость ИИ (этап 8): по сути тот же журнал, что и /dev/ai-log, но доступен админам и
// на боевом сайте — там нужно смотреть настоящую стоимость, а не только в разработке.
export default async function AdminAiLogPage() {
  const admin = await requireAdmin();
  const db = getDb();

  const [calls, recentForSummary, reports] = await Promise.all([
    db.aiCall.findMany({ orderBy: { createdAt: "desc" }, take: LIST_SIZE }),
    db.aiCall.findMany({
      where: { kind: "teaser" },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_TEASERS * 2 * 3,
      select: { teaserId: true, locale: true, durationMs: true, ok: true, createdAt: true },
    }),
    db.report.findMany({
      orderBy: { createdAt: "desc" },
      take: SUMMARY_REPORTS,
      select: {
        id: true,
        level: true,
        locale: true,
        status: true,
        model: true,
        createdAt: true,
        aiCalls: { select: { durationMs: true, costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true } },
      },
    }),
  ]);

  const teaserSummary = summarizeTeaserDurations(recentForSummary, SUMMARY_TEASERS);
  const reportSummaries = reports.map((r) => ({ r, sum: summarizeReportCalls(r.aiCalls) }));
  const totalReportCost = reportSummaries.reduce((s, { sum }) => (s === null || sum.costUsd === null ? null : s + sum.costUsd), 0 as number | null);
  const langName = (locale: string | null) => (locale ? (LOCALE_NAMES[locale] ?? locale) : "—");

  return (
    <AdminShell title="Себестоимость ИИ" isSuperAdmin={admin.role === "superadmin"}>
      <p className="text-sm text-muted">
        Полный журнал со всеми деталями (включая текст ответа ИИ) есть и на служебной странице{" "}
        <Link href="/dev/ai-log" className="font-semibold text-brand-600">
          /dev/ai-log
        </Link>{" "}
        — она видна только вне боевого сайта. Здесь та же сводка, доступная админам всегда.
      </p>

      {calls.length === 0 ? (
        <Card>
          <p className="text-muted">Вызовов ИИ пока не было.</p>
        </Card>
      ) : (
        <>
          <Card title="Сколько длится тизер">
            <p className="text-sm text-muted">По последним {SUMMARY_TEASERS} тизерам на каждом языке.</p>
            <DataTable
              head={["Язык", "Средняя длительность", "Максимум", "Удачных", "С повтором"]}
              rows={teaserSummary.map((s) => [
                langName(s.locale),
                `${seconds(s.avgMs)} с`,
                `${seconds(s.maxMs)} с`,
                `${s.ok} из ${s.teasers}`,
                String(s.retried),
              ])}
            />
          </Card>

          <Card title={`Полные отчёты: последние ${reports.length}`}>
            <p className="text-sm text-muted">
              Стоимость по этим отчётам в сумме:{" "}
              <b>{totalReportCost === null ? "неизвестна (есть модель без цены в прайсе)" : `$${totalReportCost.toFixed(4)}`}</b>
            </p>
            <div className="mt-3">
              <DataTable
                head={["Уровень", "Язык", "Статус", "Модель", "Вызовов", "Время", "Стоимость", "Токены (вх/вых/кэш)"]}
                rows={reportSummaries.map(({ r, sum }) => [
                  LEVEL_NAMES[r.level] ?? r.level,
                  langName(r.locale),
                  reportStatusOf(r.status),
                  <span key="m" className="font-mono text-xs">
                    {r.model}
                  </span>,
                  String(sum.calls),
                  `${seconds(sum.totalMs)} с`,
                  sum.costUsd === null ? "—" : `$${sum.costUsd.toFixed(4)}`,
                  <span key="t" className="font-mono text-xs">
                    {sum.inputTokens} / {sum.outputTokens} / {sum.cacheReadTokens}
                  </span>,
                ])}
              />
            </div>
          </Card>

          <Card title="Последние вызовы ИИ">
            <DataTable
              head={["Когда", "Вид", "Язык", "Попытка", "Результат", "Модель", "Длительность", "Стоимость"]}
              rows={calls.map((call) => [
                call.createdAt.toISOString().slice(0, 19).replace("T", " "),
                call.kind === "teaser" ? "тизер" : `отчёт${call.part ? ` (${call.part})` : ""}`,
                langName(call.locale),
                String(call.attempt),
                <span key="ok" className={call.ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {call.ok ? "принят" : "брак"}
                </span>,
                <span key="m" className="font-mono text-xs">
                  {call.model}
                </span>,
                `${seconds(call.durationMs)} с`,
                call.costUsd === null ? "—" : `$${call.costUsd.toFixed(4)}`,
              ])}
            />
          </Card>
        </>
      )}
    </AdminShell>
  );
}
