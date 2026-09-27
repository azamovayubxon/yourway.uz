import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TESTS } from "@/lib/assessment/tests";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { TestRunner, type RunnerTest } from "./TestRunner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Прохождение тестов. Без сессии (не выбрана развилка) — отправляем на /start.
export default async function TestPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/start");

  const { locale, t } = await getI18n();

  // В браузер уходят только тексты на текущем языке. Ключи подсчёта остаются на сервере.
  const tests: RunnerTest[] = TESTS.map((test) => ({
    id: test.id,
    questions: test.questions.map((q) => ({ id: q.id, text: q.text[locale] })),
    scaleLabels: test.scaleLabels.map((s) => ({ value: s.value, label: s.label[locale] })),
  }));

  const initialAnswers: Record<string, number> = {};
  for (const a of session.answers) initialAnswers[`${a.test}:${a.questionId}`] = a.value;

  return (
    <TestRunner
      sessionId={session.id}
      tests={tests}
      initialAnswers={initialAnswers}
      t={{ ...t.test, doneTitle: t.start.doneTitle, doneText: t.start.doneText, continueToSurvey: t.start.continueToSurvey }}
      stages={t.flow.stages}
    />
  );
}
