import { cookies } from "next/headers";
import { getLocale } from "@/i18n/server";
import { logVisit } from "@/lib/admin/funnel";
import { getSessionIdFromCookie } from "@/lib/session";

// Считает «заход на сайт» для аналитики воронки (этап 8, /admin/analytics). Вызывается один раз
// с лендинга (см. VisitPing) — не при каждом переходе по сайту. Не больше одного события на
// посетителя в сутки: это отмечает cookie yw_seen.
const SEEN_COOKIE = "yw_seen";

export async function POST() {
  const jar = await cookies();
  if (!jar.get(SEEN_COOKIE)) {
    await logVisit(await getLocale(), await getSessionIdFromCookie());
    jar.set(SEEN_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return new Response(null, { status: 204 });
}
