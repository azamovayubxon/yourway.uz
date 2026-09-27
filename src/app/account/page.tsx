import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CtaButton, PageShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { countAnswered } from "@/lib/assessment/scoring";
import { TOTAL_QUESTIONS } from "@/lib/assessment/tests";
import { isLevel, LEVELS } from "@/lib/payments";
import { listUserReports, reportStatusOf } from "@/lib/report";
import { getCurrentSession } from "@/lib/session";
import { getSessionTeasers } from "@/lib/teaser";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { ReportContent } from "@/lib/ai/report-schema";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Личный кабинет «Mening natijalarim»/«Мои результаты» (этап 7, ТЗ аудита §12, UX-19): сверху —
// последний результат и продолжение незавершённого теста, затем полные отчёты, настройки и
// удаление аккаунта — ниже, чтобы не конкурировать с полезным содержанием.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { locale, t } = await getI18n();
  const a = t.auth.account;
  const [session, reports] = await Promise.all([getCurrentSession(), listUserReports(user.id)]);
  const sessionOwnedLevels = new Set(reports.filter((r) => r.sessionId === session?.id).map((r) => r.level));
  // Не предлагаем купить уже купленный уровень (ТЗ аудита §12) — но если куплен только один
  // из двух, ссылка на checkout остаётся: там можно купить оставшийся.
  const canBuyMore = LEVELS.some((l) => !sessionOwnedLevels.has(l));

  const dateOf = (d: Date) =>
    d.toLocaleDateString(locale === "uz" ? "uz-Latn-UZ" : "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tashkent" });

  return (
    <PageShell title={a.title}>
      <div className="max-w-md space-y-5">
        <p className="rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-muted">{a.loggedInAs}</span> <b className="break-all">{user.login}</b>
        </p>

        {/* Последний результат и продолжение незавершённого теста — на первом месте (UX-19). */}
        <section>
          <h2 className="text-lg font-extrabold">{a.lastResultTitle}</h2>
          {!session ? (
            <div className="mt-3">
              <CtaButton href="/start">{a.toTests}</CtaButton>
            </div>
          ) : session.status === "survey_done" ? (
            <LastResultCard session={session} t={a} dateOf={dateOf} />
          ) : session.status === "tests_done" ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden>
                📝
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.surveyPending}</p>
                <Link href="/survey" className="mt-1 inline-flex min-h-9 items-center font-semibold text-brand-600">
                  {a.toSurvey} →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden>
                ▶
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{fmt(a.answeredOf, { n: countAnswered(session.answerMap), total: TOTAL_QUESTIONS })}</p>
                <Link href="/test" className="mt-1 inline-flex min-h-9 items-center font-semibold text-brand-600">
                  {a.continueTest} →
                </Link>
              </div>
            </div>
          )}
          <Link href="/start?new=1" className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-muted underline">
            {a.retake}
          </Link>
        </section>

        <section>
          <h2 className="text-lg font-extrabold">{a.reportsTitle}</h2>
          {reports.length === 0 ? (
            <p className="mt-2 text-muted">{a.noReports}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {reports.map((r) => {
                const status = reportStatusOf(r.status);
                const content = status === "ready" ? (r.content as unknown as ReportContent | null) : null;
                const title = content?.goal.statement ?? (isLevel(r.level) ? t.checkout.levels[r.level].name : r.level);
                return (
                  <li key={r.id} className="flex items-stretch gap-2">
                    <Link
                      href={`/report/${r.id}`}
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:border-brand-500"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden>
                        🧭
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold" lang={r.locale}>
                          {title}
                        </span>
                        <span className="block text-sm text-muted">
                          {isLevel(r.level) ? t.checkout.levels[r.level].name : r.level} ·{" "}
                          {t.checkout.reportLanguageNames[r.locale as "ru" | "uz"] ?? r.locale} · {dateOf(r.createdAt)} ·{" "}
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
          {session?.status === "survey_done" && canBuyMore && (
            <Link href="/checkout" className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-600">
              {a.toCheckout} →
            </Link>
          )}
        </section>

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

type AccountDict = Awaited<ReturnType<typeof getI18n>>["t"]["auth"]["account"];

// Карточка последнего результата (UX-19): дата и — если тизер уже готов — название типа от ИИ.
async function LastResultCard({
  session,
  t,
  dateOf,
}: {
  session: { id: string; locale: string };
  t: AccountDict;
  dateOf: (d: Date) => string;
}) {
  const teasers = await getSessionTeasers(session.id);
  const ready = teasers.find((x) => x.status === "ready");
  const content = ready?.content as unknown as TeaserContent | undefined;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg" aria-hidden>
        🪞
      </span>
      {content && (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold" lang={ready!.locale}>
            {content.personality_type_label}
          </span>
          <span className="block text-sm text-muted">{dateOf(ready!.createdAt)}</span>
        </span>
      )}
      <Link href="/teaser" className={"shrink-0 font-semibold text-brand-600" + (content ? "" : " flex-1")}>
        {t.toPortrait} →
      </Link>
    </div>
  );
}
