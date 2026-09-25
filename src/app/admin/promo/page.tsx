import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { testPaymentsEnabled } from "@/lib/payments/config";
import { AdminShell, Card, DataTable, Notice } from "../ui";
import { createPromoAction, deletePromoAction, togglePromoAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

// Промокоды (этап 8): здесь заводятся настоящие коды для боевого сайта (testOnly=false).
// Тестовые коды с /dev/promo (только вне боевого сайта) видны здесь же, их тоже можно выключить.
export default async function AdminPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const promos = await getDb().promoCode.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AdminShell title="Промокоды" isSuperAdmin={admin.role === "superadmin"}>
      {params.ok && <Notice>Готово.</Notice>}
      {params.error && <Notice kind="error">Проверьте поля: код — латиница/цифры/«_»/«-», 3–32 символа; скидка — 1–100.</Notice>}
      {!testPaymentsEnabled() && (
        <Notice kind="error">
          Тестовая оплата сейчас выключена (PAYMENTS_TEST_MODE). Промокоды со скидкой 100% на боевом
          сайте всё равно позволят получить отчёт без оплаты — так и задумано для настоящих акций.
        </Notice>
      )}

      <Card title="Новый промокод">
        <form action={createPromoAction} className="grid gap-3 sm:max-w-lg">
          <label className="grid gap-1 text-sm font-semibold">
            Код
            <input
              name="code"
              required
              placeholder="LAUNCH2026"
              className="min-h-11 rounded-xl border-2 border-slate-200 px-3 font-mono uppercase"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Скидка, %
            <input
              name="percent"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={20}
              className="min-h-11 rounded-xl border-2 border-slate-200 px-3"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Сколько раз можно использовать (пусто — без ограничения)
            <input name="maxUses" type="number" min={1} className="min-h-11 rounded-xl border-2 border-slate-200 px-3" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Действует до (пусто — бессрочно)
            <input name="expiresAt" type="date" className="min-h-11 rounded-xl border-2 border-slate-200 px-3" />
          </label>
          <button className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white">Создать</button>
        </form>
      </Card>

      <Card title={`Все коды (${promos.length})`}>
        {promos.length === 0 ? (
          <p className="text-muted">Пока нет ни одного кода.</p>
        ) : (
          <DataTable
            head={["Код", "Скидка", "Использован", "Действует до", "Статус", "Тип", ""]}
            rows={promos.map((p) => [
              <b key="code" className="font-mono">{p.code}</b>,
              `−${p.percentOff}%`,
              p.maxUses ? `${p.usedCount} / ${p.maxUses}` : `${p.usedCount}`,
              p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : "—",
              <span key="status" className={p.active ? "font-semibold text-emerald-700" : "text-muted"}>
                {p.active ? "включён" : "выключен"}
              </span>,
              p.testOnly ? "тестовый" : "боевой",
              <div key="actions" className="flex flex-wrap gap-3">
                <form action={togglePromoAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="font-semibold text-brand-600">{p.active ? "Выключить" : "Включить"}</button>
                </form>
                <form action={deletePromoAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="font-semibold text-rose-600">Удалить</button>
                </form>
              </div>,
            ])}
          />
        )}
      </Card>
    </AdminShell>
  );
}
