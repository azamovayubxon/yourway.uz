import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { reportStatusOf } from "@/lib/report";
import { summarizeReportCalls } from "@/lib/report/ai-log";
import { AdminShell, Card } from "../../ui";

export const metadata: Metadata = { robots: { index: false } };

const LEVEL_NAMES: Record<string, string> = { route: "Маршрут", navigator: "Навигатор" };
const STATUS_NAMES: Record<string, string> = { pending: "ждёт", generating: "генерируется", ready: "готов", failed: "сбой" };
const LOCALE_NAMES: Record<string, string> = { uz: "узбекский", ru: "русский" };

// Один отчёт целиком (этап 8): профиль, тизер, собранное содержимое и стоимость генерации.
export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const report = await getDb().report.findUnique({
    where: { id },
    include: { user: { select: { login: true } }, aiCalls: true },
  });
  if (!report) notFound();
  const sum = summarizeReportCalls(report.aiCalls);

  return (
    <AdminShell title={`Отчёт для ${report.user.login}`} isSuperAdmin={admin.role === "superadmin"}>
      <Card>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Уровень" value={LEVEL_NAMES[report.level] ?? report.level} />
          <Row label="Язык" value={LOCALE_NAMES[report.locale] ?? report.locale} />
          <Row label="Статус" value={STATUS_NAMES[reportStatusOf(report.status)]} />
          <Row label="Модель" value={report.model} mono />
          <Row label="Режим ИИ" value={report.aiMode === "mock" ? "тестовый (mock)" : "боевой"} />
          <Row label="Версия промпта" value={report.promptVersion} mono />
          <Row label="Создан" value={report.createdAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"} />
          {report.readyAt && <Row label="Готов" value={report.readyAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"} />}
          {report.error && <Row label="Ошибка" value={report.error} mono />}
        </dl>
      </Card>

      <Card title="Стоимость генерации">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Вызовов ИИ" value={String(sum.calls)} />
          <Row label="Время генерации" value={`${(sum.totalMs / 1000).toFixed(1)} с`} />
          <Row label="Стоимость" value={sum.costUsd === null ? "неизвестна" : `$${sum.costUsd.toFixed(4)}`} mono />
          <Row label="Токены (вход / выход / из кэша)" value={`${sum.inputTokens} / ${sum.outputTokens} / ${sum.cacheReadTokens}`} mono />
        </dl>
      </Card>

      <JsonCard title="Содержимое отчёта" value={report.content} />
      <JsonCard title="Профиль на момент оплаты" value={report.profile} />
      <JsonCard title="Тизер (вход для генерации)" value={report.teaser} />
    </AdminShell>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-slate-100 py-1">
      <dt className="text-muted">{label}:</dt>
      <dd className={"min-w-0 break-words" + (mono ? " font-mono text-xs" : "")}>{value}</dd>
    </div>
  );
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card title={title}>
      {value ? (
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="text-muted">Пусто.</p>
      )}
    </Card>
  );
}
