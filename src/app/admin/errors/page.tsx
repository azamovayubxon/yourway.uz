import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { AdminShell, Card, DataTable } from "../ui";

export const metadata: Metadata = { robots: { index: false } };

const LIST_SIZE = 100;

// Журнал ошибок сервера (этап 10В, src/lib/monitoring.ts). Сюда никогда не попадают ответы тестов,
// профиль, тексты отчётов и пароли — в meta класть их запрещено самим кодом логирования.
export default async function AdminErrorsPage() {
  const admin = await requireAdmin();
  const errors = await getDb().errorLog.findMany({ orderBy: { createdAt: "desc" }, take: LIST_SIZE });

  return (
    <AdminShell title="Ошибки" isSuperAdmin={admin.role === "superadmin"}>
      <p className="text-sm text-muted">
        Последние {LIST_SIZE} ошибок сервера. Если задана переменная SENTRY_DSN, они же уходят на внешний
        сервис (Sentry или совместимый, например самостоятельно установленный GlitchTip) — иначе видны
        только здесь, данные никуда не отправляются.
      </p>

      {errors.length === 0 ? (
        <Card>
          <p className="text-muted">Пока ни одной ошибки — хороший знак.</p>
        </Card>
      ) : (
        <Card title={`Последние ошибки (${errors.length})`}>
          <DataTable
            head={["Когда", "Место", "Сообщение", "Детали"]}
            rows={errors.map((err) => [
              err.createdAt.toISOString().slice(0, 19).replace("T", " "),
              <span key="scope" className="font-mono text-xs">
                {err.scope}
              </span>,
              err.message,
              err.meta ? (
                <span key="meta" className="font-mono text-xs text-muted">
                  {JSON.stringify(err.meta)}
                </span>
              ) : (
                "—"
              ),
            ])}
          />
        </Card>
      )}
    </AdminShell>
  );
}
