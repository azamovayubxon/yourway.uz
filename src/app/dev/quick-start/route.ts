import { redirect } from "next/navigation";
import { surveyQuestionsFor, type SurveyQuestion } from "@/lib/assessment/survey";
import { isPathType, TESTS } from "@/lib/assessment/tests";
import { devToolsEnabled } from "@/lib/dev";
import { createSession, saveAnswers, saveSurveyAnswers } from "@/lib/session";
import { getLocale } from "@/i18n/server";

// Служебная ссылка для проверки тизера: создаёт новую сессию, отвечает на все 110 вопросов
// и опрос случайно и сразу открывает /teaser. На боевом сайте не работает.
//   /dev/quick-start                   — случайный путь (знаю / не знаю цель)
//   /dev/quick-start?path=no_goal      — путь «не знаю цель» (или knows_goal)
//   /dev/quick-start?flat=1            — все ответы одинаковые: проверка подсказки о неточном результате
export const dynamic = "force-dynamic";

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function surveyValue(q: SurveyQuestion): number | string | string[] {
  switch (q.type) {
    case "number": {
      const min = q.input.min ?? 16;
      const max = Math.min(q.input.max ?? 40, min + 20);
      return min + Math.floor(Math.random() * (max - min + 1));
    }
    case "single_select":
      return pick(q.options).value;
    case "multi_select":
      return [pick(q.options).value];
    case "text":
      return q.required ? "Хочу работать в IT / IT sohasida ishlashni xohlayman" : "";
  }
}

export async function GET(request: Request) {
  if (!devToolsEnabled()) return new Response("Not found", { status: 404 });
  const params = new URL(request.url).searchParams;
  const pathParam = params.get("path");
  const pathType = isPathType(pathParam) ? pathParam : pick(["knows_goal", "no_goal"] as const);
  const flat = params.get("flat") === "1";
  const locale = await getLocale();

  const sessionId = await createSession(pathType, locale);
  await saveAnswers(
    sessionId,
    TESTS.flatMap((test) =>
      test.questions.map((q) => ({
        test: test.id,
        questionId: q.id,
        value: flat ? 3 : 1 + Math.floor(Math.random() * 5),
      })),
    ),
  );
  await saveSurveyAnswers(
    sessionId,
    pathType,
    locale,
    surveyQuestionsFor(pathType).map((q) => ({ questionId: q.id, value: surveyValue(q) })),
  );
  redirect("/teaser");
}
