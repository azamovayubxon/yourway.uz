import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getFunnel, getSoonInterest } from "@/lib/admin/funnel";
import { AdminShell, Card, DataTable } from "../ui";

export const metadata: Metadata = { robots: { index: false } };

// Аналитика воронки (этап 8): заход → старт теста → конец теста → тизер → регистрация →
// оплата → PDF, с разбивкой по языкам. Заход и PDF считаются по журналу FunnelEvent
// (src/lib/admin/funnel.ts), остальные шаги — напрямую по данным (TestSession, Teaser, User, Payment).
// Ниже — интерес к направлениям «Скоро» с главной (события soon:<id> в том же журнале).
export default async function AdminAnalyticsPage() {
  const admin = await requireAdmin();
  const [funnel, soon] = await Promise.all([getFunnel(), getSoonInterest()]);
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
      <Card title="Интерес к направлениям">
        <p className="mb-3 text-sm text-muted">
          Нажатия на карточки «Скоро» на главной. Один посетитель засчитывается по одному направлению не
          чаще раза в сутки. Сортировка — по убыванию числа нажатий за всё время.
        </p>
        <DataTable
          head={["Направление", "7 дней", "30 дней", "Всё время"]}
          rows={soon.map((row) => [row.label, String(row.last7), String(row.last30), <b key="t">{row.total}</b>])}
        />
      </Card>
    </AdminShell>
  );
}
