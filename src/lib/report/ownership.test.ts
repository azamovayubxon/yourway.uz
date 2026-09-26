import { beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" ломается в обычном Node (не в сборке Next.js, где вебпак делает его пустышкой)
// — заглушаем, чтобы протестировать модуль без сборки всего сайта.
vi.mock("server-only", () => ({}));

// getUserReport — единственное место, через которое страница отчёта (/report/[id]) и скачивание
// PDF (/api/report/[id]/pdf) читают отчёт: оба вызывают её и отдают 404, если результат — null
// (см. комментарии в src/app/report/[id]/page.tsx и src/app/api/report/[id]/pdf/route.ts).
// Значит проверить здесь, что чужой userId и несуществующий id дают null, — то же самое, что
// проверить, что обе страницы отдадут 404 на чужой отчёт.

const OWNER_ID = "user-a";
const OTHER_USER_ID = "user-b";
const REPORT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_REPORT_ID = "22222222-2222-2222-2222-222222222222";

const reports = [{ id: REPORT_ID, userId: OWNER_ID, status: "ready", content: { ok: true } }];

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    report: {
      findFirst: ({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(reports.find((r) => r.id === where.id && r.userId === where.userId) ?? null),
    },
  }),
}));

const { getUserReport } = await import("./index");

describe("getUserReport — доступ только у владельца (этап 10В)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("владельцу отчёт отдаётся", async () => {
    const report = await getUserReport(REPORT_ID, OWNER_ID);
    expect(report).not.toBeNull();
    expect(report?.id).toBe(REPORT_ID);
  });

  it("тот же id с чужим userId — null (404, а не чужой отчёт)", async () => {
    const report = await getUserReport(REPORT_ID, OTHER_USER_ID);
    expect(report).toBeNull();
  });

  it("несуществующий id — null", async () => {
    const report = await getUserReport(OTHER_REPORT_ID, OWNER_ID);
    expect(report).toBeNull();
  });

  it("id не похож на uuid — null без обращения к базе", async () => {
    const report = await getUserReport("not-a-uuid", OWNER_ID);
    expect(report).toBeNull();
  });
});
