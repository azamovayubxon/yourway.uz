import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" ломается в обычном Node (не в сборке Next.js) — заглушаем, как и в других тестах
// на модули с "server-only" наверху.
vi.mock("server-only", () => ({}));

// Устойчивость этапа C2: повторное событие оплаты (двойной клик «Оплатить», повтор сети —
// то же самое, что повторный вебхук настоящего шлюза на этапе 9) не должно ни создать второй
// отчёт, ни списать дважды, ни уронить неожиданную ошибку наружу. Обычный повтор (страница уже
// знает про payment.status="paid") confirmTestPayment уже обрабатывал раньше. Здесь проверяем
// более узкий случай — НАСТОЯЩУЮ ГОНКУ: два запроса читают payment.status="pending" почти
// одновременно, оба пытаются его подтвердить; Postgres блокирует конкурирующий UPDATE до коммита
// первого, так что проигравший видит updateMany.count === 0 — раньше это приводило к
// необработанному исключению ("payment: уже обработан"), теперь проигравший должен найти уже
// созданный победителем отчёт и вернуть его id, а не упасть.

const PAYMENT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "user-a";

let createReportCalls = 0;
vi.mock("@/lib/report", () => ({
  createReportInTx: async () => {
    createReportCalls += 1;
    return "report-created-by-this-call";
  },
}));

// getDb() должен возвращать один и тот же объект при каждом вызове внутри одного теста —
// иначе мутации, которые имитируют гонку, не будут видны другому вызову getDb() внутри кода.
let paymentRow: {
  id: string;
  userId: string;
  provider: string;
  status: string;
  promoCodeId: string | null;
  report: { id: string } | null;
};
let updateManyOverride: ((args: { where: { status: string } }) => Promise<{ count: number } | null>) | null = null;

const payment = {
  findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
    paymentRow.id === where.id && paymentRow.userId === where.userId ? { ...paymentRow } : null,
  findUnique: async ({ where }: { where: { id: string } }) => (paymentRow.id === where.id ? { ...paymentRow } : null),
  updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
    if (updateManyOverride) {
      const overridden = await updateManyOverride({ where });
      if (overridden) return overridden;
    }
    if (paymentRow.status !== where.status) return { count: 0 };
    Object.assign(paymentRow, data);
    return { count: 1 };
  },
  update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(paymentRow, data),
};

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    payment,
    $transaction: async (fn: (tx: { payment: typeof payment }) => Promise<unknown>) => fn({ payment }),
  }),
}));

const { confirmTestPayment } = await import("./index");

describe("confirmTestPayment — идемпотентность при гонке (этап C2)", () => {
  beforeEach(() => {
    createReportCalls = 0;
    updateManyOverride = null;
    paymentRow = { id: PAYMENT_ID, userId: USER_ID, provider: "test", status: "pending", promoCodeId: null, report: null };
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PAYMENTS_TEST_MODE", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("обычный повтор (страница уже знает, что оплачено) — тот же отчёт, без второго создания", async () => {
    paymentRow.status = "paid";
    paymentRow.report = { id: "already-ready" };
    const result = await confirmTestPayment(PAYMENT_ID, USER_ID);
    expect(result).toEqual({ ok: true, reportId: "already-ready" });
    expect(createReportCalls).toBe(0);
  });

  it("настоящая гонка: наш снимок ещё pending, но UPDATE уже опоздал — не падает, отдаёт отчёт победителя", async () => {
    // Первый вызов updateMany в этом сценарии имитирует то, что произошло бы в Postgres:
    // конкурирующий запрос уже закоммитился между нашим findFirst и нашим UPDATE.
    let first = true;
    updateManyOverride = async () => {
      if (!first) return null;
      first = false;
      paymentRow.status = "paid";
      paymentRow.report = { id: "winner-report" };
      return { count: 0 };
    };

    const result = await confirmTestPayment(PAYMENT_ID, USER_ID);
    expect(result).toEqual({ ok: true, reportId: "winner-report" });
    expect(createReportCalls).toBe(0);
  });

  it("нормальная оплата без гонки — создаёт отчёт один раз", async () => {
    const result = await confirmTestPayment(PAYMENT_ID, USER_ID);
    expect(result).toEqual({ ok: true, reportId: "report-created-by-this-call" });
    expect(createReportCalls).toBe(1);
    expect(paymentRow.status).toBe("paid");
  });
});
