import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/guard";
import { AdminShell, Card } from "./ui";

export const metadata: Metadata = { robots: { index: false } };

// Обзорная страница админки (этап 8): кто вошёл, короткие счётчики, ссылки на разделы.
export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const db = getDb();
  const [users, payments, reports, sessions] = await Promise.all([
    db.user.count(),
    db.payment.count({ where: { status: "paid" } }),
    db.report.count(),
    db.testSession.count(),
  ]);

  return (
    <AdminShell title="Обзор" isSuperAdmin={admin.role === "superadmin"}>
      <p className="text-sm text-muted">
        Вы вошли как <b>{admin.login}</b> · роль:{" "}
        <b>{admin.role === "superadmin" ? "суперадмин" : "администратор"}</b>
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Аккаунтов" value={users} />
        <Stat label="Оплаченных отчётов" value={payments} />
        <Stat label="Отчётов всего" value={reports} />
        <Stat label="Прохождений тестов" value={sessions} />
      </div>

      <Card title="Разделы">
        <ul className="grid gap-2 sm:grid-cols-2">
          <NavItem href="/admin/prices" text="Цены уровней «Маршрут» и «Навигатор»" />
          <NavItem href="/admin/promo" text="Промокоды: создать, включить/выключить, удалить" />
          <NavItem href="/admin/prompts" text="Тексты промптов и выбор модели ИИ по уровню и языку" />
          <NavItem href="/admin/reports" text="Просмотр оплаченных отчётов" />
          <NavItem href="/admin/analytics" text="Воронка: заход → тест → тизер → регистрация → оплата → PDF" />
          <NavItem href="/admin/ai-log" text="Себестоимость ИИ: журнал вызовов, токены, стоимость" />
          {admin.role === "superadmin" && <NavItem href="/admin/admins" text="Кто ещё администратор" />}
        </ul>
      </Card>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function NavItem({ href, text }: { href: string; text: string }) {
  return (
    <li>
      <Link href={href} className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
        {text}
      </Link>
    </li>
  );
}
