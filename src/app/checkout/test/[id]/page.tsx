import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserPayment, isLevel } from "@/lib/payments";
import { testPaymentsEnabled } from "@/lib/payments/config";
import { formatSum } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { FlowLabel } from "@/components/flow";
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
    <div className="mx-auto max-w-md px-4 pb-14 pt-6 lg:pt-10">
      <FlowLabel>{t.checkout.kicker}</FlowLabel>
      <p className="mt-3 flex gap-3 rounded-3xl border-2 border-dashed border-sun bg-sun-50 px-5 py-4 text-sm font-medium leading-relaxed text-sun-ink">
        <FlaskIcon />
        <span>{p.banner}</span>
      </p>
      <div className="mt-5 rounded-[28px] border border-line bg-white p-6">
        <h1 className="text-2xl font-extrabold leading-tight">{p.title}</h1>
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
                <dd className="tabular-nums text-teal">−{sum(payment.baseAmount - payment.amount)}</dd>
              </div>
            </>
          )}
        </dl>
        <div className="mt-4 flex items-baseline justify-between gap-3 rounded-3xl bg-ink px-5 py-4 text-on-dark">
          <span className="text-on-dark-muted">{p.amount}</span>
          <span className="whitespace-nowrap font-display text-2xl font-extrabold tabular-nums">{sum(payment.amount)}</span>
        </div>

        {payment.status === "pending" ? (
          <form action={testPaymentAction} className="mt-5 grid gap-2">
            <input type="hidden" name="paymentId" value={payment.id} />
            <button
              name="outcome"
              value="pay"
              className="focus-ring min-h-14 rounded-full bg-brand-500 px-6 text-lg font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700"
            >
              {p.pay}
            </button>
            <button
              name="outcome"
              value="decline"
              className="focus-ring min-h-12 rounded-full border-2 border-line bg-white px-6 font-semibold text-ink hover:border-brand-500"
            >
              {p.decline}
            </button>
            <button name="outcome" value="cancel" className="focus-ring min-h-12 rounded-full px-6 font-semibold text-muted underline hover:text-ink">
              {p.cancel}
            </button>
          </form>
        ) : (
          <div className="mt-5">
            <p className="text-muted">{p.done}</p>
            <Link href="/checkout" className="focus-ring mt-3 inline-flex min-h-11 items-center rounded font-bold text-brand-500 hover:text-brand-600">
              ← {t.checkout.title}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-5 shrink-0" aria-hidden focusable="false">
      <path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}
