import { surveyQuestionsFor } from "@/lib/assessment/survey";
import type { PathType } from "@/lib/assessment/tests";
import { getSessionIdFromCookie, isValidSurveyAnswer, loadSession, saveSurveyAnswers } from "@/lib/session";
import { getLocale } from "@/i18n/server";

// Автосохранение ответов опроса: POST /api/session/survey
// Тело: { sessionId, answers: [{ questionId, value }] }.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const { sessionId, answers } = (body ?? {}) as { sessionId?: unknown; answers?: unknown };

  // Ответы принимаются только в сессию из cookie этого браузера.
  const cookieId = await getSessionIdFromCookie();
  if (!cookieId || cookieId !== sessionId) {
    return Response.json({ error: "session_mismatch" }, { status: 409 });
  }
  const session = await loadSession(cookieId);
  if (!session) {
    return Response.json({ error: "session_not_found" }, { status: 409 });
  }
  // До этого шага должны быть пройдены все тесты.
  if (session.status === "in_progress") {
    return Response.json({ error: "tests_not_done" }, { status: 409 });
  }

  const pathType = session.pathType as PathType;
  const maxBatch = surveyQuestionsFor(pathType).length;
  if (
    !Array.isArray(answers) ||
    answers.length === 0 ||
    answers.length > maxBatch ||
    !answers.every((a) => isValidSurveyAnswer(pathType, a))
  ) {
    return Response.json({ error: "bad_answers" }, { status: 400 });
  }

  const locale = await getLocale();
  const result = await saveSurveyAnswers(session.id, pathType, locale, answers);
  return Response.json({ ok: true, ...result });
}
