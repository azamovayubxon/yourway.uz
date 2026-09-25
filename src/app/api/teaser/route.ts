import type { Profile } from "@/lib/assessment/profile";
import { getCurrentSession } from "@/lib/session";
import { clientIp, hashIp, requestTeaser } from "@/lib/teaser";
import { getLocale } from "@/i18n/server";

// Генерация тизера: POST /api/teaser. Язык тизера = текущий язык интерфейса (cookie).
// Запрос можно повторять: если тизер уже готов или генерируется, новая генерация не запускается.
// Ответ: { status: "ready" | "generating" | "failed" | "limit" | "not_ready", reason? }.
export const dynamic = "force-dynamic";
// Сколько секунд хостинг даёт на ответ (Vercel читает это поле, другие хостинги его игнорируют).
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ status: "not_ready" }, { status: 409 });

  const state = await requestTeaser({
    sessionId: session.id,
    status: session.status,
    profile: session.profile as Profile | null,
    locale: await getLocale(),
    ipHash: hashIp(clientIp(request.headers)),
  });
  return Response.json(state, { status: state.status === "not_ready" ? 409 : 200 });
}
