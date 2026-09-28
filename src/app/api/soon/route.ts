import { cookies } from "next/headers";
import { getLocale } from "@/i18n/server";
import { logSoonClick } from "@/lib/admin/funnel";
import { isSoonDirection } from "@/lib/directions";
import { getSessionIdFromCookie } from "@/lib/session";

// Счётчик интереса к направлениям «Скоро» на главной (таблица в /admin/analytics). Вызывается при
// нажатии на карточку (src/components/landing/DirectionsGrid.tsx) и пишет событие soon:<id>.
// Защита от накрутки — как у /api/visit: не больше одного события на одно направление от посетителя
// в сутки, это отмечает cookie yw_soon_<id>. Неизвестный id — отказ 400 (в журнал попадают только
// направления из src/lib/directions.ts).
export async function POST(request: Request) {
  let id: unknown;
  try {
    id = ((await request.json()) as { id?: unknown } | null)?.id;
  } catch {
    id = undefined;
  }
  if (!isSoonDirection(id)) return new Response(null, { status: 400 });

  const jar = await cookies();
  const cookieName = `yw_soon_${id}`;
  if (!jar.get(cookieName)) {
    await logSoonClick(id, await getLocale(), await getSessionIdFromCookie());
    jar.set(cookieName, "1", {
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return new Response(null, { status: 204 });
}
