import type { Metadata } from "next";
import { LEVELS } from "@/lib/payments/prices";
import { requireAdmin } from "@/lib/admin/guard";
import { getDb } from "@/lib/db";
import { AdminShell, Card, Notice } from "../ui";
import { updatePriceAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

const LEVEL_NAMES: Record<string, string> = { route: "«Маршрут»", navigator: "«Навигатор»" };

// Цены уровней полного отчёта (этап 8): хранятся в таблице Price, здесь их можно менять
// без SQL. Пустой уровень в базе — уровень нельзя купить (см. src/lib/payments/prices.ts).
export default async function AdminPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const rows = await getDb().price.findMany();
  const byLevel = new Map(rows.map((r) => [r.level, r]));

  return (
    <AdminShell title="Цены" isSuperAdmin={admin.role === "superadmin"}>
      {params.ok && <Notice>Цена сохранена.</Notice>}
      {params.error && <Notice kind="error">Проверьте значение — цена должна быть целым числом сумов, не меньше 0.</Notice>}

      <Card>
        <p className="text-sm text-muted">
          Цена в сумах. Пусто в базе (уровня нет в таблице) — уровень не продаётся на сайте, пока
          цену не задать здесь.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {LEVELS.map((level) => {
            const row = byLevel.get(level);
            return (
              <form key={level} action={updatePriceAction} className="grid gap-2 rounded-2xl border border-slate-200 p-4">
                <input type="hidden" name="level" value={level} />
                <p className="font-bold">{LEVEL_NAMES[level] ?? level}</p>
                <label className="grid gap-1 text-sm font-semibold">
                  Цена, сум
                  <input
                    name="amount"
                    type="number"
                    min={0}
                    step={100}
                    required
                    defaultValue={row?.amount ?? ""}
                    className="min-h-11 rounded-xl border-2 border-slate-200 px-3"
                  />
                </label>
                {row && <p className="text-xs text-muted">Обновлено: {row.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>}
                <button className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white">Сохранить</button>
              </form>
            );
          })}
        </div>
      </Card>
    </AdminShell>
  );
}
