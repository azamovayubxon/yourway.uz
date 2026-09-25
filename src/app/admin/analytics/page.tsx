import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getFunnel } from "@/lib/admin/funnel";
import { AdminShell, Card, DataTable } from "../ui";

export const metadata: Metadata = { robots: { index: false } };

// Аналитика воронки (этап 8): заход → старт теста → конец теста → тизер → регистрация →
// оплата → PDF, с разбивкой по языкам. Заход и PDF считаются по журналу FunnelEvent
// (src/lib/admin/funnel.ts), остальные шаги — напрямую по данным (TestSession, Teaser, User, Payment).
export default async function AdminAnalyticsPage() {
  const admin = await requireAdmin();
  const funnel = await getFunnel();
  const first = funnel[0]?.total ?? 0;

  return (
    <AdminShell title="Аналитика воронки" isSuperAdmin={admin.role === "superadmin"}>
      <Card title="Воронка по шагам">
        <p className="mb-3 text-sm text-muted">
          «Заход» считается с первого открытия главной страницы (не чаще раза в сутки на одного
          посетителя). Проценты — от числа заходов.
        </p>
        <DataTable
          head={["Шаг", "Узбекский", "Русский", "Всего", "% от заходов"]}
          rows={funnel.map((step) => [
            step.label,
            String(step.byLocale.uz ?? 0),
            String(step.byLocale.ru ?? 0),
            <b key="t">{step.total}</b>,
            first > 0 ? `${Math.round((step.total / first) * 100)}%` : "—",
          ])}
        />
      </Card>
    </AdminShell>
  );
}
