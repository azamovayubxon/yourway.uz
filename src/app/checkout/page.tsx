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
import { FlowLabel } from "@/components/flow";
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
    db.teaser.findFirst({ where: { sessionId: session.id, status: "ready" }, select: { id: true, content: true } }),
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

  // UX-18: без своей цели «Маршрут» нельзя оплатить, не выбрав цель — из направлений бесплатного
  // результата или свою. Если цель в профиле уже есть (её вписали в анкете или на прошлом заходе
  // на checkout), повторно не спрашиваем.
  const profile = session.profile as { goal?: { statement?: string } } | null;
  const needsGoal = pathType === "no_goal" && !profile?.goal?.statement;
  const directionOptions = (teaser.content as { fitting_directions?: { title: string }[] } | null)?.fitting_directions?.map(
    (d) => d.title,
  ) ?? [];

  return (
    <div className="mx-auto max-w-xl px-4 pb-14 pt-6 lg:max-w-5xl lg:pt-8">
      <Link href="/teaser" className="focus-ring inline-flex min-h-11 items-center rounded text-sm font-semibold text-muted hover:text-ink">
        ← {t.checkout.backToPortrait}
      </Link>
      <FlowLabel className="mt-2">{t.checkout.kicker}</FlowLabel>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight lg:text-[40px]">{t.checkout.title}</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">{t.checkout.subtitle}</p>
      <Link
        href="/#sample"
        className="focus-ring mt-1 inline-flex min-h-11 items-center rounded text-sm font-bold text-brand-500 underline hover:text-brand-600"
      >
        {t.checkout.exampleLinkLabel} →
      </Link>
      {notice && (
        <p className="mt-4 rounded-3xl bg-sun-50 px-5 py-3.5 text-sm font-medium text-sun-ink" role="status">
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
        needsGoal={needsGoal}
        directionOptions={directionOptions}
        legalLinks={[
          { href: "/offer", label: t.footer.offer },
          { href: "/refund", label: t.footer.refund },
          { href: "/privacy", label: t.footer.privacy },
        ]}
      />
    </div>
  );
}
