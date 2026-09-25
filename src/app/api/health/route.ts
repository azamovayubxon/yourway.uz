import { getDb } from "@/lib/db";

// Проверка, что сайт работает и видит базу данных: GET /api/health
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "ok" });
  } catch (error) {
    console.error("health: база данных недоступна", error);
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
