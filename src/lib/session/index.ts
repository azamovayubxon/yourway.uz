import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { buildProfile } from "@/lib/assessment/profile";
import { computeScores, countAnswered } from "@/lib/assessment/scoring";
import { surveyQuestionsFor } from "@/lib/assessment/survey";
import { TOTAL_QUESTIONS, type PathType } from "@/lib/assessment/tests";
import { dedupeLast, rowsToAnswers, type AnswerInput } from "./answers";
import type { SurveyAnswerInput } from "./survey-answers";

export { isValidAnswer } from "./answers";
export { isValidSurveyAnswer } from "./survey-answers";
import type { Locale } from "@/i18n/config";

// Анонимная сессия прохождения тестов: id хранится в cookie, ответы — в базе.
export const SESSION_COOKIE = "yw_session";
// Сколько помнить незаконченную сессию: 180 дней.
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function getSessionIdFromCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

// Текущая сессия вместе с ответами (или null, если её нет).
// Сессия, привязанная к аккаунту, доступна только тому, кто вошёл в этот аккаунт: после выхода
// (или если cookie осталась от другого человека) её как будто нет.
export async function getCurrentSession() {
  const id = await getSessionIdFromCookie();
  if (!id) return null;
  const session = await loadSession(id);
  if (!session) return null;
  if (session.userId && session.userId !== (await getCurrentUser())?.id) return null;
  return session;
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

// Новая сессия. Если человек уже вошёл в аккаунт, она сразу привязывается к нему.
export async function createSession(pathType: PathType, locale: Locale): Promise<string> {
  const user = await getCurrentUser();
  const session = await getDb().testSession.create({ data: { pathType, locale, userId: user?.id ?? null } });
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
  // Все ответы — одним запросом (INSERT … ON CONFLICT DO UPDATE). Раньше каждый ответ был отдельным
  // запросом внутри транзакции: при 110 ответах (после обрыва связи или в /dev/quick-start) и удалённой
  // базе (Vercel → Neon) транзакция не укладывалась в 5 секунд Prisma и запрос падал с ошибкой 500.
  const batch = dedupeLast(answers, (a) => `${a.test}:${a.questionId}`);
  if (batch.length > 0) {
    await db.$executeRaw`
      INSERT INTO "TestAnswer" ("sessionId", "test", "questionId", "value", "updatedAt")
      SELECT ${sessionId}, a.test, a.question_id, a.value, NOW()
      FROM unnest(${batch.map((a) => a.test)}::text[], ${batch.map((a) => a.questionId)}::int[], ${batch.map((a) => a.value)}::int[])
        AS a(test, question_id, value)
      ON CONFLICT ("sessionId", "test", "questionId")
      DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = EXCLUDED."updatedAt"`;
  }

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
  // Одним запросом, как и ответы тестов (см. saveAnswers).
  const batch = dedupeLast(answers, (a) => a.questionId);
  if (batch.length > 0) {
    await db.$executeRaw`
      INSERT INTO "SurveyAnswer" ("sessionId", "questionId", "value", "updatedAt")
      SELECT ${sessionId}, a.question_id, a.value::jsonb, NOW()
      FROM unnest(${batch.map((a) => a.questionId)}::text[], ${batch.map((a) => JSON.stringify(a.value))}::text[])
        AS a(question_id, value)
      ON CONFLICT ("sessionId", "questionId")
      DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = EXCLUDED."updatedAt"`;
  }

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
