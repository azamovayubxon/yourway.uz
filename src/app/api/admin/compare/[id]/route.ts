import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { effectiveRole } from "@/lib/admin/role";
import { advanceComparison } from "@/lib/compare";

// Слепое сравнение моделей: POST /api/admin/compare/<id>. Страница /admin/compare спрашивает его
// раз в 3 секунды, пока обе генерации не закончатся. Как у полного отчёта: ответ приходит сразу,
// а если есть вариант, который никто не генерирует, в фоне (after()) запускается ОДНА его попытка.
// Ответ: { variants: [{ slot, status }], done } — без названий моделей (сравнение слепое).
// Только superadmin; остальным — 404, как и вся админка.
export const dynamic = "force-dynamic";
// Как у /api/report: одна попытка части отчёта укладывается в REPORT_ATTEMPT_TIMEOUT_MS = 270 с.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ status: "not_found" }, { status: 404 });
  const row = await getDb().user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (!row || effectiveRole({ login: user.login, role: row.role }) !== "superadmin") {
    return Response.json({ status: "not_found" }, { status: 404 });
  }
  const { state, job } = await advanceComparison((await params).id);
  if (!state) return Response.json({ status: "not_found" }, { status: 404 });
  if (job) after(job);
  return Response.json(state);
}
