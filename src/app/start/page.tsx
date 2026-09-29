import Link from "next/link";
import type { ReactNode } from "react";
import { FlowLabel } from "@/components/flow";
import { CtaButton } from "@/components/ui";
import { countAnswered } from "@/lib/assessment/scoring";
import { PATH_TYPE_QUESTION, TOTAL_QUESTIONS } from "@/lib/assessment/tests";
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
      <StartShell label={t.flow.brandLabel} title={t.start.surveyDoneTitle}>
        <p className="text-lg text-muted">{t.start.surveyDoneText}</p>
        <CtaButton href="/teaser">{t.start.toTeaser}</CtaButton>
        <RestartLink label={t.start.restart} />
      </StartShell>
    );
  }

  if (session?.status === "tests_done") {
    return (
      <StartShell label={t.flow.brandLabel} title={t.start.doneTitle}>
        <p className="text-lg text-muted">{t.start.doneText}</p>
        <CtaButton href="/survey">{t.start.continueToSurvey}</CtaButton>
        <RestartLink label={t.start.restart} />
      </StartShell>
    );
  }

  if (session) {
    return (
      <StartShell label={t.flow.brandLabel} title={t.start.resumeTitle}>
        <p className="text-lg text-muted">
          {fmt(t.start.resumeText, { done: countAnswered(session.answerMap), total: TOTAL_QUESTIONS })}
        </p>
        <CtaButton href="/test">{t.start.resume}</CtaButton>
        <RestartLink label={t.start.restart} />
      </StartShell>
    );
  }

  return (
    <StartShell label={t.flow.brandLabel} title={PATH_TYPE_QUESTION.text[locale]}>
      <p className="text-muted lg:text-lg">{t.start.subtitle}</p>
      {/* Карточки выбора — в стиле карточек главной: белые, скругление 28px, при наведении и фокусе
          — терракотовая рамка. */}
      <form action={startTests} className="!mt-8 grid gap-4 sm:grid-cols-2">
        {PATH_TYPE_QUESTION.options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="pathType"
            value={o.value}
            className="focus-ring group flex min-h-24 flex-col rounded-[28px] border-2 border-line bg-white p-5 text-left transition-colors hover:border-brand-500 focus-visible:border-brand-500 active:bg-brand-50 sm:p-6"
          >
            <span className="flex w-full items-start justify-between gap-3">
              <PathIcon kind={o.value} />
              <span aria-hidden className="pt-2 text-xl font-bold text-brand-500 transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
            <span className="mt-4 block font-display text-xl font-bold leading-tight">{o.label[locale]}</span>
            <span className="mt-1.5 block leading-snug text-muted">{t.start.hints[o.value]}</span>
          </button>
        ))}
      </form>
      <p className="text-sm text-muted">{t.start.note}</p>
    </StartShell>
  );
}

// Каркас экранов /start: метка «KASB YOʻLI», крупный заголовок, содержимое.
function StartShell({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12 pt-8 lg:max-w-4xl lg:pt-16">
      <FlowLabel>{label}</FlowLabel>
      <h1 className="mt-3 hyphens-auto break-words text-[28px] font-extrabold leading-[1.15] sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      <div className="mt-4 space-y-5 leading-relaxed">{children}</div>
    </div>
  );
}

// Значок карточки выбора: «мишень» — цель уже есть, «компас» — цель ещё ищем.
function PathIcon({ kind }: { kind: string }) {
  const goal = kind === "knows_goal";
  return (
    <span aria-hidden className={"flex size-12 items-center justify-center rounded-2xl " + (goal ? "bg-brand-50 text-brand-600" : "bg-teal-50 text-teal")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="size-6" focusable="false">
        {goal ? (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="0.8" fill="currentColor" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
          </>
        )}
      </svg>
    </span>
  );
}

function RestartLink({ label }: { label: string }) {
  return (
    <Link href="/start?new=1" className="focus-ring block rounded py-2 text-sm font-semibold text-muted underline">
      {label}
    </Link>
  );
}
