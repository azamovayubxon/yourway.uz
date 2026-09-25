import { after } from "next/server";
import type { Profile } from "@/lib/assessment/profile";
import { getCurrentSession } from "@/lib/session";
import { clientIp, getTeaserStatus, hashIp, requestTeaser } from "@/lib/teaser";
import { getLocale } from "@/i18n/server";

// Генерация тизера: POST /api/teaser. Язык тизера = текущий язык интерфейса (cookie).
// Запрос отвечает сразу (за доли секунды): сама генерация идёт в фоне через after() — это обычная
// возможность Next.js, работает и на Vercel, и на своём сервере с `next start`. Страница повторяет
// запрос каждые 3 секунды и узнаёт статус; новая генерация при этом не запускается.
// Ответ: { status: "ready" | "generating" | "failed" | "limit" | "not_ready", reason? }.
//
// GET /api/teaser — только узнать статус (ничего не запускает): { status: "ready" | "generating" |
// "failed" | "none" }. Страница опрашивает его, пока идёт генерация.
export const dynamic = "force-dynamic";
// Сколько секунд хостинг даёт функции вместе с фоновой работой (Vercel читает это поле,
// другие хостинги его игнорируют). Генерация укладывается в TEASER_TIME_BUDGET_MS = 100 с.
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ status: "not_ready" }, { status: 409 });

  const { state, job } = await requestTeaser({
    sessionId: session.id,
    status: session.status,
    profile: session.profile as Profile | null,
    locale: await getLocale(),
    ipHash: hashIp(clientIp(request.headers)),
  });
  if (job) after(job);
  return Response.json(state, { status: state.status === "not_ready" ? 409 : 200 });
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return Response.json({ status: "none" }, { status: 409 });
  return Response.json({ status: await getTeaserStatus(session.id, await getLocale()) });
}
