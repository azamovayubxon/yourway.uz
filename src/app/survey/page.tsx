import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { surveySectionsFor } from "@/lib/assessment/survey";
import type { PathType } from "@/lib/assessment/tests";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { SurveyRunner, type RunnerSurveySection } from "./SurveyRunner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Контекстный опрос: идёт сразу после тестов (Приложение А §11, шаг 6).
export default async function SurveyPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/start");
  if (session.status === "in_progress") redirect("/test");

  const { locale, t } = await getI18n();
  const pathType = session.pathType as PathType;

  const sections: RunnerSurveySection[] = surveySectionsFor(pathType).map((s) => ({
    id: s.id,
    title: s.title[locale],
    questions: s.questions.map((q) => ({
      id: q.id,
      type: q.type,
      required: q.required,
      text: q.text[locale],
      options: q.options.map((o) => ({ value: o.value, label: o.label[locale] })),
      input: q.input,
    })),
  }));

  return (
    <SurveyRunner
      sessionId={session.id}
      sections={sections}
      initialAnswers={session.surveyAnswerMap}
      t={t.survey}
      stages={t.flow.stages}
      pathType={pathType}
    />
  );
}
