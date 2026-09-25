import { getSessionIdFromCookie, isValidAnswer, loadSession, saveAnswers } from "@/lib/session";
import { TOTAL_QUESTIONS } from "@/lib/assessment/tests";

// Автосохранение ответов: POST /api/session/answers
// Тело: { sessionId, answers: [{ test, questionId, value }] }.
// Браузер присылает пачку ответов (обычно один; после обрыва связи — все накопленные).
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
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > TOTAL_QUESTIONS || !answers.every(isValidAnswer)) {
    return Response.json({ error: "bad_answers" }, { status: 400 });
  }
  const session = await loadSession(cookieId);
  if (!session) {
    return Response.json({ error: "session_not_found" }, { status: 409 });
  }

  const result = await saveAnswers(session.id, answers);
  return Response.json({ ok: true, ...result });
}
