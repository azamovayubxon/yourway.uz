import Link from "next/link";
import { CtaButton, PageShell } from "@/components/ui";
import { countAnswered } from "@/lib/assessment/scoring";
import { PATH_TYPE_QUESTION, TOTAL_QUESTIONS } from "@/lib/assessment/tests";
import { devToolsEnabled } from "@/lib/dev";
import { getCurrentSession } from "@/lib/session";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { startTests } from "./actions";

export const dynamic = "force-dynamic";

// Экран-развилка (Приложение А §11, шаг 1). Если тесты уже начаты — предлагаем продолжить.
// «Начать заново» (/start?new=1) снова показывает развилку; старая сессия не удаляется.
export default async function StartPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { locale, t } = await getI18n();
  const wantsNew = (await searchParams).new === "1";
  const session = wantsNew ? null : await getCurrentSession();

  if (session?.status === "survey_done") {
    return (
      <PageShell title={t.start.surveyDoneTitle}>
        <p className="text-lg text-muted">{t.start.surveyDoneText}</p>
        {devToolsEnabled() && (
          <Link href={`/dev/profile/${session.id}`} className="block py-2 font-semibold text-brand-600">
            {t.test.devLink} →
          </Link>
        )}
        <RestartLink label={t.start.restart} />
      </PageShell>
    );
  }

  if (session?.status === "tests_done") {
    return (
      <PageShell title={t.start.doneTitle}>
        <p className="text-lg text-muted">{t.start.doneText}</p>
        <CtaButton href="/survey">{t.start.continueToSurvey}</CtaButton>
        {devToolsEnabled() && (
          <Link href={`/dev/profile/${session.id}`} className="block py-2 font-semibold text-brand-600">
            {t.test.devLink} →
          </Link>
        )}
        <RestartLink label={t.start.restart} />
      </PageShell>
    );
  }

  if (session) {
    return (
      <PageShell title={t.start.resumeTitle}>
        <p className="text-lg text-muted">
          {fmt(t.start.resumeText, { done: countAnswered(session.answerMap), total: TOTAL_QUESTIONS })}
        </p>
        <CtaButton href="/test">{t.start.resume}</CtaButton>
        <RestartLink label={t.start.restart} />
      </PageShell>
    );
  }

  return (
    <PageShell title={PATH_TYPE_QUESTION.text[locale]}>
      <p className="text-muted">{t.start.subtitle}</p>
      <form action={startTests} className="grid gap-3 sm:grid-cols-2">
        {PATH_TYPE_QUESTION.options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="pathType"
            value={o.value}
            className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand-500 active:bg-brand-50"
          >
            <span className="block text-lg font-bold">{o.label[locale]}</span>
            <span className="mt-1 block text-sm text-muted">{t.start.hints[o.value]}</span>
          </button>
        ))}
      </form>
      <p className="text-sm text-muted">{t.start.note}</p>
    </PageShell>
  );
}

function RestartLink({ label }: { label: string }) {
  return (
    <Link href="/start?new=1" className="block py-2 text-sm font-semibold text-muted underline">
      {label}
    </Link>
  );
}
