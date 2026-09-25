import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { reportStatusOf } from "@/lib/report";
import { AdminShell, Card, DataTable } from "../ui";

export const metadata: Metadata = { robots: { index: false } };

const LEVEL_NAMES: Record<string, string> = { route: "Маршрут", navigator: "Навигатор" };
const STATUS_NAMES: Record<string, string> = { pending: "ждёт", generating: "генерируется", ready: "готов", failed: "сбой" };
const LOCALE_NAMES: Record<string, string> = { uz: "узбекский", ru: "русский" };
const LIST_SIZE = 100;

// Просмотр отчётов (этап 8): последние оплаченные отчёты, их статус и ссылка на содержимое.
export default async function AdminReportsPage() {
  const admin = await requireAdmin();
  const reports = await getDb().report.findMany({
    orderBy: { createdAt: "desc" },
    take: LIST_SIZE,
    select: {
      id: true,
      level: true,
      locale: true,
      status: true,
      model: true,
      createdAt: true,
      readyAt: true,
      user: { select: { login: true } },
    },
  });

  return (
    <AdminShell title="Отчёты" isSuperAdmin={admin.role === "superadmin"}>
      <Card title={`Последние ${reports.length} отчётов`}>
        {reports.length === 0 ? (
          <p className="text-muted">Отчётов пока нет.</p>
        ) : (
          <DataTable
            head={["Аккаунт", "Уровень", "Язык", "Статус", "Модель", "Создан", ""]}
            rows={reports.map((r) => [
              r.user.login,
              LEVEL_NAMES[r.level] ?? r.level,
              LOCALE_NAMES[r.locale] ?? r.locale,
              STATUS_NAMES[reportStatusOf(r.status)],
              <span key="m" className="font-mono text-xs">
                {r.model}
              </span>,
              r.createdAt.toISOString().slice(0, 16).replace("T", " "),
              <Link key="l" href={`/admin/reports/${r.id}`} className="font-semibold text-brand-600">
                Открыть
              </Link>,
            ])}
          />
        )}
      </Card>
    </AdminShell>
  );
}
