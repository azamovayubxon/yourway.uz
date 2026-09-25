import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CtaButton, PageShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isLevel } from "@/lib/payments";
import { listUserReports, reportStatusOf } from "@/lib/report";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Личный кабинет (этап 7): кто вошёл, оплаченные отчёты (открыть, скачать PDF), переход к портрету,
// повторное прохождение тестов, смена пароля, удаление аккаунта, выход.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { locale, t } = await getI18n();
  const a = t.auth.account;
  const [session, reports] = await Promise.all([getCurrentSession(), listUserReports(user.id)]);
  const sessionHasReport = !!session && reports.some((r) => r.sessionId === session.id);

  return (
    <PageShell title={a.title}>
      <div className="max-w-md space-y-5">
        <p className="rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-muted">{a.loggedInAs}</span> <b className="break-all">{user.login}</b>
        </p>

        <section>
          <h2 className="text-lg font-extrabold">{a.reportsTitle}</h2>
          {reports.length === 0 ? (
            <p className="mt-2 text-muted">{a.noReports}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {reports.map((r) => {
                const status = reportStatusOf(r.status);
                return (
                  <li key={r.id} className="flex items-stretch gap-2">
                    <Link
                      href={`/report/${r.id}`}
                      className="flex min-h-16 flex-1 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:border-brand-500"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden>
                        🧭
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">
                          {isLevel(r.level) ? t.checkout.levels[r.level].name : r.level}
                        </span>
                        <span className="block text-sm text-muted">
                          {r.createdAt.toLocaleDateString(locale === "uz" ? "uz-Latn-UZ" : "ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "Asia/Tashkent",
                          })}{" "}
                          ·{" "}
                          <span className={status === "ready" ? "text-emerald-700" : status === "failed" ? "text-amber-700" : ""}>
                            {a.reportStatus[status]}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-brand-600">{a.open} →</span>
                    </Link>
                    {status === "ready" && (
                      <a
                        href={`/api/report/${r.id}/pdf`}
                        className="flex min-h-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 px-4 font-semibold text-brand-600 hover:border-brand-500"
                        aria-label={a.pdf}
                      >
                        {a.pdf}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {session?.status === "survey_done" ? (
          <div className="flex flex-col gap-2">
            <CtaButton href="/teaser">{t.auth.account.toPortrait}</CtaButton>
            {!sessionHasReport && (
              <Link href="/checkout" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
                {a.toCheckout} →
              </Link>
            )}
            <Link href="/start?new=1" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted underline">
              {a.retake}
            </Link>
          </div>
        ) : (
          <CtaButton href="/start">{t.auth.account.toTests}</CtaButton>
        )}

        <section className="border-t border-slate-100 pt-5">
          <h2 className="text-lg font-extrabold">{a.settingsTitle}</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/account/password" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
              {a.changePasswordLink} →
            </Link>
            <Link href="/account/delete" className="inline-flex min-h-11 items-center font-semibold text-rose-600">
              {a.deleteAccountLink} →
            </Link>
          </div>
        </section>

        <form action={logoutAction} className="border-t border-slate-100 pt-5">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-2xl border-2 border-slate-200 px-5 font-semibold text-ink hover:border-slate-300"
          >
            {a.logout}
          </button>
          <p className="mt-2 text-sm text-muted">{a.logoutNote}</p>
        </form>
      </div>
    </PageShell>
  );
}
