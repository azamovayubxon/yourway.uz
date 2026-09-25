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
//
// Если что-то сломалось (например, база недоступна), показывает страницу с текстом ошибки,
// а не пустой белый экран.
export const dynamic = "force-dynamic";
// Сколько секунд хостинг даёт на ответ (Vercel читает это поле, другие хостинги его игнорируют).
export const maxDuration = 60;

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

  try {
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
    const survey = await saveSurveyAnswers(
      sessionId,
      pathType,
      locale,
      surveyQuestionsFor(pathType).map((q) => ({ questionId: q.id, value: surveyValue(q) })),
    );
    if (!survey.surveyDone) throw new Error(`опрос не завершён: ${survey.answered} из ${survey.total}`);
  } catch (error) {
    console.error("[dev] quick-start failed", error);
    return errorPage(error);
  }
  // redirect() работает через исключение, поэтому вызываем его вне try.
  redirect("/teaser");
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

// Служебная страница: сайт в режиме разработки, поэтому текст ошибки показываем как есть.
function errorPage(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>quick-start: ошибка</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">Не удалось создать тестовую сессию</h1>
<p>Служебная ссылка /dev/quick-start упала с ошибкой. Подробности — в логах сервера (Vercel → Logs, строка <code>[dev] quick-start failed</code>).</p>
<pre style="white-space:pre-wrap;background:#f1f5f9;padding:1rem;border-radius:.75rem">${escapeHtml(message.slice(0, 2000))}</pre>
<p><a href="/dev/quick-start">Попробовать ещё раз</a></p>
</body></html>`;
  return new Response(html, { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}
