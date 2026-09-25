import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { computeScores, countAnswered } from "@/lib/assessment/scoring";
import { TOTAL_QUESTIONS, type PathType } from "@/lib/assessment/tests";
import { rowsToAnswers, type AnswerInput } from "./answers";

export { isValidAnswer } from "./answers";
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
  const session = await getDb().testSession.findUnique({ where: { id }, include: { answers: true } });
  if (!session) return null;
  return { ...session, answerMap: rowsToAnswers(session.answers) };
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
