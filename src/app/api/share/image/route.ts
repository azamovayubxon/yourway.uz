import { logShareImage } from "@/lib/admin/funnel";
import { typeCardImage } from "@/lib/og/share-images";
import { checkAndHitRateLimit } from "@/lib/rate-limit";
import { getCurrentSession } from "@/lib/session";
import { getOwnedReadyTeaser } from "@/lib/share";
import { shareSnapshot } from "@/lib/share/code";

// «Сохранить картинку» (этап 2б): GET /api/share/image?teaser=<id> → PNG 1080×1350 (карточка типа
// и логотип) файлом yourway-tip.png. Доступно ТОЛЬКО владельцу тизера (cookie сессии): чужой или
// несуществующий тизер — 404. Открытую страницу /t/[code] этот маршрут НЕ создаёт. Каждое
// скачивание пишет событие share_image для /admin/analytics.
export const dynamic = "force-dynamic";

const LIMIT_PER_HOUR = 30;

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 404 });
  const teaser = await getOwnedReadyTeaser(session.id, new URL(request.url).searchParams.get("teaser"));
  if (!teaser) return new Response(null, { status: 404 });

  // Картинка рисуется на сервере и стоит процессорного времени — ограничиваем частоту.
  if (!(await checkAndHitRateLimit(`shareimg:${session.id}`, LIMIT_PER_HOUR, 60 * 60 * 1000))) {
    return new Response(null, { status: 429 });
  }

  const locale = teaser.locale === "ru" ? "ru" : "uz";
  await logShareImage(locale, session.id);
  return typeCardImage(
    { locale, ...shareSnapshot(teaser.content) },
    {
      "Content-Disposition": 'attachment; filename="yourway-tip.png"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  );
}
