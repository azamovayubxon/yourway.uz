import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PlaceholderNote } from "@/components/ui";
import { getDb } from "@/lib/db";
import { devToolsEnabled } from "@/lib/dev";
import { testPaymentsEnabled } from "@/lib/payments/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { createTestPromoAction, togglePromoAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Служебная страница: тестовые промокоды для проверки оплаты. На боевом сайте — 404, а созданные
// здесь коды на боевом сайте не действуют (testOnly). Настоящие промокоды — в админке (этап 8).
export default async function DevPromoPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  if (!devToolsEnabled()) notFound();
  const { t } = await getI18n();
  const d = t.devPromo;
  const params = await searchParams;
  const promos = await getDb().promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <PageShell title={d.title}>
      <PlaceholderNote>{d.note}</PlaceholderNote>
      {!testPaymentsEnabled() && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{d.testModeOff}</p>}
      {params.ok && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">✓ {d.created}</p>}
      {params.error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{d.invalid}</p>}

      <form action={createTestPromoAction} className="grid max-w-md gap-3 rounded-2xl border border-slate-200 p-4">
        <label className="grid gap-1 text-sm font-semibold">
          {d.code}
          <input
            name="code"
            required
            defaultValue="TEST100"
            className="min-h-12 rounded-2xl border-2 border-slate-200 px-4 font-mono uppercase"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {d.percent}
          <input
            name="percent"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={100}
            className="min-h-12 rounded-2xl border-2 border-slate-200 px-4"
          />
        </label>
        <button className="min-h-12 rounded-2xl bg-brand-500 px-6 font-bold text-white">{d.create}</button>
      </form>

      <h2 className="pt-4 font-bold">{d.listTitle}</h2>
      {promos.length === 0 ? (
        <p className="text-muted">{d.empty}</p>
      ) : (
        <ul className="space-y-2">
          {promos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <b className="font-mono">{p.code}</b>
              <span>−{p.percentOff}%</span>
              <span className="text-muted">{fmt(d.used, { n: p.usedCount })}</span>
              <span className={p.active ? "text-emerald-700" : "text-muted"}>{p.active ? d.active : d.inactive}</span>
              {!p.testOnly && <span className="text-muted">{d.real}</span>}
              {p.testOnly && (
                <form action={togglePromoAction} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="min-h-11 font-semibold text-brand-600">{p.active ? d.disable : d.enable}</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
