import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { buildProfile } from "@/lib/assessment/profile";
import { computeScores, countAnswered } from "@/lib/assessment/scoring";
import { surveyQuestionsFor } from "@/lib/assessment/survey";
import { TOTAL_QUESTIONS, type PathType } from "@/lib/assessment/tests";
import { rowsToAnswers, type AnswerInput } from "./answers";
import type { SurveyAnswerInput } from "./survey-answers";

export { isValidAnswer } from "./answers";
export { isValidSurveyAnswer } from "./survey-answers";
import type { Locale } from "@/i18n/config";

// Анонимная сессия прохождения тестов: id хранится в cookie, ответы — в базе.
export const SESSION_COOKIE = "yw_session";
// Сколько помнить незаконченную сессию: 180 дней.
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function getSessionIdFromCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

// Текущая сессия вместе с ответами (или null, если её нет).
export async function getCurrentSession() {
  const id = await getSessionIdFromCookie();
  if (!id) return null;
  return loadSession(id);
}

export async function loadSession(id: string) {
  // id — это uuid; всё остальное сразу отбрасываем, не обращаясь к базе.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const session = await getDb().testSession.findUnique({
    where: { id },
    include: { answers: true, surveyAnswers: true },
  });
  if (!session) return null;
  const surveyAnswerMap: Record<string, number | string | string[]> = {};
  for (const a of session.surveyAnswers) surveyAnswerMap[a.questionId] = a.value as number | string | string[];
  return { ...session, answerMap: rowsToAnswers(session.answers), surveyAnswerMap };
}

export async function createSession(pathType: PathType, locale: Locale): Promise<string> {
  const session = await getDb().testSession.create({ data: { pathType, locale } });
  (await cookies()).set(SESSION_COOKIE, session.id, {
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return session.id;
}

// Сохраняет ответы. Когда отвечены все 110 вопросов, считает баллы и сохраняет их в сессии.
export async function saveAnswers(sessionId: string, answers: AnswerInput[]) {
  const db = getDb();
  await db.$transaction(
    answers.map((a) =>
      db.testAnswer.upsert({
        where: { sessionId_test_questionId: { sessionId, test: a.test, questionId: a.questionId } },
        create: { sessionId, test: a.test, questionId: a.questionId, value: a.value },
        update: { value: a.value },
      }),
    ),
  );

  const rows = await db.testAnswer.findMany({ where: { sessionId } });
  const answerMap = rowsToAnswers(rows);
  const answered = countAnswered(answerMap);
  if (answered < TOTAL_QUESTIONS) {
    return { answered, testsDone: false };
  }
  const scores = computeScores(answerMap);
  const session = await db.testSession.findUniqueOrThrow({ where: { id: sessionId } });
  await db.testSession.update({
    where: { id: sessionId },
    data: {
      status: session.status === "in_progress" ? "tests_done" : session.status,
      scores: JSON.parse(JSON.stringify(scores)),
      testsDoneAt: session.testsDoneAt ?? new Date(),
    },
  });
  return { answered, testsDone: true };
}

// Сохраняет ответы опроса. Когда отвечены все вопросы для этого пути (knows_goal / no_goal),
// собирает профиль (Приложение А §9) и сохраняет его в сессии.
export async function saveSurveyAnswers(
  sessionId: string,
  pathType: PathType,
  locale: Locale,
  answers: SurveyAnswerInput[],
) {
  const db = getDb();
  await db.$transaction(
    answers.map((a) =>
      db.surveyAnswer.upsert({
        where: { sessionId_questionId: { sessionId, questionId: a.questionId } },
        create: { sessionId, questionId: a.questionId, value: JSON.parse(JSON.stringify(a.value)) },
        update: { value: JSON.parse(JSON.stringify(a.value)) },
      }),
    ),
  );

  const total = surveyQuestionsFor(pathType).length;
  const validIds = new Set(surveyQuestionsFor(pathType).map((q) => q.id));
  const rows = (await db.surveyAnswer.findMany({ where: { sessionId } })).filter((r) => validIds.has(r.questionId));
  const answered = rows.length;
  if (answered < total) {
    return { answered, total, surveyDone: false };
  }

  const testRows = await db.testAnswer.findMany({ where: { sessionId } });
  const profile = buildProfile(
    pathType,
    locale,
    rowsToAnswers(testRows),
    rows.map((r) => ({ questionId: r.questionId, value: r.value })),
  );
  const session = await db.testSession.findUniqueOrThrow({ where: { id: sessionId } });
  await db.testSession.update({
    where: { id: sessionId },
    data: {
      status: "survey_done",
      profile: JSON.parse(JSON.stringify(profile)),
      profileDoneAt: session.profileDoneAt ?? new Date(),
    },
  });
  return { answered, total, surveyDone: true };
}
