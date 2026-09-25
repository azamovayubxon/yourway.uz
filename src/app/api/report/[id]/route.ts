import { cookies } from "next/headers";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { devToolsEnabled } from "@/lib/dev";
import { advanceReport } from "@/lib/report";
import { AI_FAIL_COOKIE } from "@/lib/report/dev";

// Генерация полного отчёта: POST /api/report/<id>. Страница отчёта спрашивает его раз в 3 секунды.
// Ответ приходит сразу: если никто не генерирует, сервер запускает ОДНУ попытку следующей части
// в фоне (after() — обычная возможность Next.js, работает и на Vercel, и на своём сервере).
// Тело запроса (необязательно): { "regenerate": true } — «Сгенерировать заново» после сбоя.
// Ответ: { status: "generating" | "ready" | "failed", done, total }.
// Отчёт видит только владелец аккаунта: чужой или несуществующий — 404.
export const dynamic = "force-dynamic";
// Сколько секунд хостинг даёт запросу вместе с фоновой работой (Vercel читает это поле, другие
// хостинги его игнорируют). Одна попытка одной части укладывается в REPORT_ATTEMPT_TIMEOUT_MS = 270 с.
// Значение должно совпадать с REPORT_MAX_DURATION_SEC в src/lib/ai/config.ts (Next.js требует здесь число).
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ status: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { regenerate?: unknown };
  // Имитация сбоя ИИ — только вне боевого сайта (служебная страница /dev/ai-fail).
  const simulateFailure = devToolsEnabled() && (await cookies()).get(AI_FAIL_COOKIE)?.value === "1";

  const { state, job } = await advanceReport({
    reportId: (await params).id,
    userId: user.id,
    regenerate: body.regenerate === true,
    simulateFailure,
  });
  if (!state) return Response.json({ status: "not_found" }, { status: 404 });
  if (job) after(job);
  return Response.json(state);
}
