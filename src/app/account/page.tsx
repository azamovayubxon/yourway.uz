import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompassMark } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { countAnswered } from "@/lib/assessment/scoring";
import { TOTAL_QUESTIONS } from "@/lib/assessment/tests";
import { getPricesSafe, isLevel, LEVELS, type Level } from "@/lib/payments";
import { listUserReports, reportStatusOf } from "@/lib/report";
import { getCurrentSession } from "@/lib/session";
import { getSessionTeasers } from "@/lib/teaser";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { ReportContent } from "@/lib/ai/report-schema";
import { fmt, formatSum } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

type Dict = Awaited<ReturnType<typeof getI18n>>["t"];
type AccountDict = Dict["auth"]["account"];

// Личный кабинет «Mening natijalarim»/«Мои результаты» (этап 7, ТЗ аудита §12, UX-19; новый
// стиль — этап 3): сверху — последний результат и продолжение незавершённого теста, затем полные
// отчёты, предложение второго пакета, пересдача, ниже — настройки и удаление аккаунта.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { locale, t } = await getI18n();
  const a = t.auth.account;
  const [session, reports, prices] = await Promise.all([getCurrentSession(), listUserReports(user.id), getPricesSafe()]);
  const sessionOwnedLevels = new Set(reports.filter((r) => r.sessionId === session?.id).map((r) => r.level));
  // Не предлагаем купить уже купленный уровень (ТЗ аудита §12) — но если куплен только один
  // из двух, предлагаем оставшийся (карточка с ценой из базы); если ни одного — просто ссылка
  // на checkout.
  const missingLevels = LEVELS.filter((l) => !sessionOwnedLevels.has(l));
  const canBuyMore = missingLevels.length > 0;
  const offerLevel: Level | null = missingLevels.length === 1 ? missingLevels[0]! : null;

  const dateOf = (d: Date) =>
    d.toLocaleDateString(locale === "uz" ? "uz-Latn-UZ" : "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tashkent" });

  return (
    <div className="mx-auto max-w-xl px-4 pb-14 pt-8 lg:pt-12">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight lg:text-[40px]">{a.title}</h1>

      {/* Последний результат и продолжение незавершённого теста — на первом месте (UX-19). */}
      <section className="mt-6">
        {!session ? (
          <>
            <h2 className="text-lg font-extrabold">{a.lastResultTitle}</h2>
            <Link href="/start" className={primaryButton + " mt-3"}>
              {a.toTests}
            </Link>
          </>
        ) : session.status === "survey_done" ? (
          <LastResultCard session={session} t={a} dateOf={dateOf} />
        ) : (
          <>
            <h2 className="text-lg font-extrabold">{a.lastResultTitle}</h2>
            <div className="mt-3 rounded-3xl border border-line bg-white p-5">
              <p className="font-semibold">
                {session.status === "tests_done"
                  ? a.surveyPending
                  : fmt(a.answeredOf, { n: countAnswered(session.answerMap), total: TOTAL_QUESTIONS })}
              </p>
              <Link href={session.status === "tests_done" ? "/survey" : "/test"} className={primaryButton + " mt-4 w-full"}>
                {session.status === "tests_done" ? a.toSurvey : a.continueTest}
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold">{a.reportsTitle}</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-muted">{a.noReports}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => {
              const status = reportStatusOf(r.status);
              const content = status === "ready" ? (r.content as unknown as ReportContent | null) : null;
              const levelName = isLevel(r.level) ? t.checkout.levels[r.level].name : r.level;
              const title = content?.goal.statement ?? levelName;
              return (
                <li key={r.id} className="rounded-3xl border border-line bg-white p-4 sm:p-5">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 font-bold " +
                        (r.level === "navigator" ? "bg-ink text-on-dark" : "bg-brand-50 text-brand-700")
                      }
                    >
                      {levelName}
                    </span>
                    <span className="text-muted">
                      {t.checkout.reportLanguageNames[r.locale as "ru" | "uz"] ?? r.locale} · {dateOf(r.createdAt)}
                    </span>
                    <span
                      className={
                        "ml-auto inline-flex items-center gap-1 font-bold " +
                        (status === "ready" ? "text-teal" : status === "failed" ? "text-brand-700" : "text-muted")
                      }
                    >
                      {status === "ready" && <span aria-hidden>✓</span>}
                      {a.reportStatus[status]}
                    </span>
                  </p>
                  <p className="mt-2 line-clamp-3 font-display text-lg font-bold leading-snug" lang={r.locale}>
                    {title}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/report/${r.id}`}
                      className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand-500 px-5 font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700"
                    >
                      {a.open}
                    </Link>
                    {status === "ready" && (
                      <a
                        href={`/api/report/${r.id}/pdf`}
                        aria-label={`${a.pdf} — ${title}`}
                        className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white px-5 font-bold text-ink hover:border-ink"
                      >
                        {a.pdf}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Второй пакет (если куплен только один) — пунктирная карточка с ценой из базы;
            если не куплено ничего — просто ссылка на выбор пакета. */}
        {session?.status === "survey_done" && canBuyMore && (
          offerLevel ? (
            <Link
              href="/checkout"
              className="focus-ring mt-3 block rounded-3xl border-2 border-dashed border-line p-5 transition-colors hover:border-brand-500"
            >
              <span className="block font-display font-bold leading-snug">
                {t.checkout.levels[offerLevel].name} — {t.checkout.levels[offerLevel].tagline}
              </span>
              <span className="mt-1 block text-sm text-muted">{t.checkout.levels[offerLevel].features[1]}</span>
              <span className="mt-2 block font-bold text-brand-500">
                {prices[offerLevel] !== undefined
                  ? fmt(a.offerCta, { sum: formatSum(prices[offerLevel]!, t.common.sum) })
                  : a.toCheckout}{" "}
                →
              </span>
            </Link>
          ) : (
            <Link href="/checkout" className="focus-ring mt-3 inline-flex min-h-11 items-center rounded font-bold text-brand-500 hover:text-brand-600">
              {a.toCheckout} →
            </Link>
          )
        )}
      </section>

      {/* Пересдача: новая сессия (/start?new=1). Подписи «прежние результаты сохранятся» нет
          намеренно: полные отчёты остаются в кабинете, но прежний бесплатный результат после
          пересдачи из кабинета больше не открывается (карточка выше показывает текущую сессию). */}
      <Link
        href="/start?new=1"
        className="focus-ring mt-6 flex min-h-14 items-center justify-between gap-3 rounded-3xl bg-sand px-5 py-4 font-bold transition-colors hover:bg-brand-50"
      >
        {a.retake}
        <span aria-hidden className="text-lg text-brand-500">
          →
        </span>
      </Link>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-muted">{a.settingsTitle}</h2>
        <p className="mt-3 text-sm">
          <span className="text-muted">{a.loggedInAs}</span> <b className="break-all">{user.login}</b>
        </p>
        <div className="mt-2 flex flex-col items-start">
          <Link href="/account/password" className="focus-ring inline-flex min-h-11 items-center rounded font-semibold text-ink hover:text-brand-600">
            {a.changePasswordLink}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="focus-ring inline-flex min-h-11 items-center rounded font-semibold text-ink hover:text-brand-600">
              {a.logout}
            </button>
          </form>
          <Link href="/account/delete" className="focus-ring inline-flex min-h-11 items-center rounded font-semibold text-danger hover:underline">
            {a.deleteAccountLink}
          </Link>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{a.logoutNote}</p>
      </section>
    </div>
  );
}

const primaryButton =
  "focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-brand-500 px-7 font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700";

// Карточка последнего результата (UX-19): бирюзовая, мини-компас, «Oxirgi natija · дата» и — если
// тизер уже готов — название типа от ИИ; под ней белая кнопка «Natijani ochish».
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
    <>
      <div className="flex items-center gap-4 rounded-3xl bg-teal p-5 text-white">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-teal-800" aria-hidden>
          <CompassMark size={40} variant="dark" />
        </span>
        <div className="min-w-0">
          <h2 className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-on-teal-muted">
            {t.lastResultTitle}
            {ready && <span> · {dateOf(ready.createdAt)}</span>}
          </h2>
          {content && (
            <span className="mt-1 block break-words font-display text-xl font-extrabold leading-tight" lang={ready!.locale}>
              {content.personality_type_label}
            </span>
          )}
        </div>
      </div>
      <Link
        href="/teaser"
        className="focus-ring mt-3 flex min-h-12 w-full items-center justify-center rounded-full border-2 border-line bg-white px-6 font-bold text-ink hover:border-ink"
      >
        {t.openResult}
      </Link>
    </>
  );
}
