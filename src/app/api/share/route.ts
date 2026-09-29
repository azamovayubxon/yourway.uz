import { checkAndHitRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/lib/session";
import { getOrCreateShareCard, getOwnedReadyTeaser } from "@/lib/share";

// «Поделиться» на странице бесплатного результата (этап 2б): POST /api/share { teaserId } →
// { code } — код открытой страницы /t/[code]. Только для готового тизера ТЕКУЩЕЙ сессии (cookie
// сессии, как в /api/teaser): чужой или несуществующий тизер — 404, без подсказки, что он есть.
// Повторное нажатие возвращает тот же код (одна карточка на тизер). Ограничение частоты — по
// сессии, через общий счётчик RateLimitHit.
export const dynamic = "force-dynamic";

const LIMIT_PER_HOUR = 30;

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });

  let teaserId: unknown;
  try {
    teaserId = ((await request.json()) as { teaserId?: unknown } | null)?.teaserId;
  } catch {
    teaserId = undefined;
  }
  const teaser = await getOwnedReadyTeaser(session.id, teaserId);
  if (!teaser) return Response.json({ error: "not_found" }, { status: 404 });

  if (!(await checkAndHitRateLimit(`share:${session.id}`, LIMIT_PER_HOUR, 60 * 60 * 1000))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const code = await getOrCreateShareCard(teaser);
  return Response.json({ code }, { headers: { "Cache-Control": "no-store" } });
}
