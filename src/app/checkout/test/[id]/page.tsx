import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserPayment, isLevel } from "@/lib/payments";
import { testPaymentsEnabled } from "@/lib/payments/config";
import { formatSum } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { testPaymentAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Тестовый «платёжный шлюз» (провайдер `test`): вместо страницы Payme/Click/Uzum. Есть только там,
// где включена тестовая оплата (PAYMENTS_TEST_MODE=true и не боевой сайт), иначе — 404.
export default async function TestPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!testPaymentsEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  const payment = await getUserPayment((await params).id, user.id);
  if (!payment || payment.provider !== "test") notFound();
  if (payment.status === "paid" && payment.report) redirect(`/report/${payment.report.id}`);

  const { t } = await getI18n();
  const p = t.testPay;
  const sum = (n: number) => formatSum(n, t.common.sum);
  const levelName = isLevel(payment.level) ? t.checkout.levels[payment.level].name : payment.level;

  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-6">
      <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm font-medium text-amber-900">
        🧪 {p.banner}
      </div>
      <div className="mt-6 rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">{p.title}</h1>
        <dl className="mt-5 space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{p.level}</dt>
            <dd className="font-semibold">{levelName}</dd>
          </div>
          {payment.baseAmount !== payment.amount && (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{p.base}</dt>
                <dd className="tabular-nums">{sum(payment.baseAmount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{p.discount}</dt>
                <dd className="tabular-nums">−{sum(payment.baseAmount - payment.amount)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 text-lg">
            <dt className="font-semibold">{p.amount}</dt>
            <dd className="font-extrabold tabular-nums">{sum(payment.amount)}</dd>
          </div>
        </dl>

        {payment.status === "pending" ? (
          <form action={testPaymentAction} className="mt-6 grid gap-2">
            <input type="hidden" name="paymentId" value={payment.id} />
            <button
              name="outcome"
              value="pay"
              className="min-h-14 rounded-2xl bg-emerald-600 px-6 text-lg font-bold text-white hover:bg-emerald-700"
            >
              {p.pay}
            </button>
            <button
              name="outcome"
              value="decline"
              className="min-h-12 rounded-2xl border-2 border-slate-200 px-6 font-semibold text-ink hover:border-slate-300"
            >
              {p.decline}
            </button>
            <button name="outcome" value="cancel" className="min-h-12 px-6 font-semibold text-muted underline">
              {p.cancel}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <p className="text-muted">{p.done}</p>
            <Link href="/checkout" className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-600">
              ← {t.checkout.title}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
