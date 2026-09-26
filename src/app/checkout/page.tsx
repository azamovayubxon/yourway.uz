import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPrices, LEVELS, type Level } from "@/lib/payments";
import { testPaymentsEnabled } from "@/lib/payments/config";
import { activePaymentProvider } from "@/lib/payments/providers";
import type { PathType } from "@/lib/assessment/tests";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Выбор уровня полного отчёта и оплата (этап 6). Сюда человек попадает сразу после регистрации
// (или входа) с тизера. Оба уровня доступны всем; подходящий по развилке выделен как рекомендуемый
// (решение (В)): knows_goal → «Маршрут», no_goal → «Навигатор».
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; declined?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/register?next=/checkout");
  const session = await getCurrentSession();
  if (!session) redirect("/start");
  if (session.status !== "survey_done") redirect("/teaser");
  const db = getDb();
  const [teaser, reports, prices] = await Promise.all([
    db.teaser.findFirst({ where: { sessionId: session.id, status: "ready" }, select: { id: true } }),
    db.report.findMany({ where: { sessionId: session.id, userId: user.id }, select: { id: true, level: true } }),
    getPrices(),
  ]);
  // Полный отчёт опирается на тизер (Приложение Б §5): без него сначала получаем портрет.
  if (!teaser) redirect("/teaser");

  const { locale, t } = await getI18n();
  const params = await searchParams;
  const pathType = session.pathType as PathType;
  const recommended: Level = pathType === "knows_goal" ? "route" : "navigator";
  const existing: Partial<Record<Level, string>> = {};
  for (const r of reports) if ((LEVELS as readonly string[]).includes(r.level)) existing[r.level as Level] = r.id;
  const notice = params.cancelled ? t.checkout.cancelled : params.declined ? t.checkout.declined : null;
  const error = params.error && params.error in t.checkout.errors ? params.error : null;

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <Link href="/teaser" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted">
        ← {t.checkout.backToPortrait}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{t.checkout.title}</h1>
      <p className="mt-2 leading-relaxed text-muted">{t.checkout.subtitle}</p>
      {notice && (
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="status">
          {notice}
        </p>
      )}
      <CheckoutForm
        t={t.checkout}
        locale={locale}
        levelOrder={recommended === "route" ? ["route", "navigator"] : ["navigator", "route"]}
        recommended={recommended}
        recommendedWhy={t.checkout.recommendedWhy[pathType]}
        prices={prices}
        existing={existing}
        testMode={testPaymentsEnabled()}
        paymentsAvailable={activePaymentProvider() !== null}
        initialError={error}
        sumTemplate={t.common.sum}
      />
    </div>
  );
}
