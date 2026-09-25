import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { isEnvSuperAdmin } from "@/lib/admin/role";
import { AdminShell, Card, DataTable, Notice } from "../ui";
import { setUserRoleAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

// Кто администратор (этап 8, только для суперадминов).
// Суперадминов по переменной окружения SUPERADMIN_LOGINS отсюда снять нельзя — так и задумано:
// владелец не может случайно потерять себе доступ через саму админку.
export default async function AdminAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const admins = await getDb().user.findMany({
    where: { role: { in: ["admin", "superadmin"] } },
    select: { login: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const envLogins = (process.env.SUPERADMIN_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <AdminShell title="Администраторы" isSuperAdmin>
      {params.ok && <Notice>Роль изменена.</Notice>}
      {params.error === "notfound" && <Notice kind="error">Такого логина нет среди зарегистрированных аккаунтов.</Notice>}
      {params.error === "1" && <Notice kind="error">Проверьте логин и роль.</Notice>}

      <Card title="Суперадмины из переменной окружения">
        <p className="text-sm text-muted">
          Задаются переменной <code className="font-mono">SUPERADMIN_LOGINS</code> (в Vercel:
          Settings → Environment Variables). Эти логины — суперадмины всегда, даже без записи в
          базе, и их роль нельзя понизить из этой страницы.
        </p>
        {envLogins.length === 0 ? (
          <p className="mt-2 text-muted">Переменная не задана.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {envLogins.map((l) => (
              <li key={l} className="rounded-full bg-slate-100 px-3 py-1 font-mono text-sm">
                {l}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Назначить или снять роль «администратор»">
        <p className="text-sm text-muted">У человека уже должен быть аккаунт (логин и пароль) на сайте.</p>
        <form action={setUserRoleAction} className="mt-3 grid max-w-md gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Логин
            <input name="login" required className="min-h-11 rounded-xl border-2 border-slate-200 px-3" />
          </label>
          <fieldset className="flex gap-4 text-sm font-semibold">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="role" value="admin" defaultChecked /> сделать администратором
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="role" value="user" /> убрать права
            </label>
          </fieldset>
          <button className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white">Сохранить</button>
        </form>
      </Card>

      <Card title="Администраторы в базе">
        {admins.length === 0 ? (
          <p className="text-muted">Пока никто не назначен через базу (кроме суперадминов из переменной окружения выше).</p>
        ) : (
          <DataTable
            head={["Логин", "Роль", "С какого числа"]}
            rows={admins.map((a) => [
              a.login,
              a.role === "superadmin" ? "суперадмин" : "администратор",
              a.createdAt.toISOString().slice(0, 10),
            ])}
          />
        )}
        {admins.some((a) => isEnvSuperAdmin(a.login)) && (
          <p className="mt-2 text-xs text-muted">Часть логинов выше уже и так суперадмины по переменной окружения.</p>
        )}
      </Card>
    </AdminShell>
  );
}
