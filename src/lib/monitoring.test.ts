import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("scrubSensitiveText — вторая линия защиты (этап 10В)", () => {
  it("вырезает пароль и код восстановления из JSON-подобного текста", async () => {
    const { scrubSensitiveText } = await import("./monitoring");
    const text = 'Не удалось создать аккаунт: {"login":"ozod","password":"SuperSecret123!"}';
    const out = scrubSensitiveText(text);
    expect(out).not.toContain("SuperSecret123!");
    expect(out).toContain("ozod"); // логин — не секрет, его трогать не нужно
  });

  it("вырезает профиль и ответы тестов, даже если оказались прямо в тексте ошибки", async () => {
    const { scrubSensitiveText } = await import("./monitoring");
    const text = 'Zod error at profile: {"riasec_code":"RIA","values_scores":{"money":10}}, answers=[1,2,3,4,5]';
    const out = scrubSensitiveText(text);
    expect(out).not.toContain("riasec_code");
    expect(out).not.toContain("RIA");
    expect(out).not.toContain("money");
    expect(out).not.toContain("[1,2,3,4,5]");
  });

  it("вырезает текст отчёта (content/portrait/goal) из простого key=value", async () => {
    const { scrubSensitiveText } = await import("./monitoring");
    const text = "content=Вы человек, который любит структуру и порядок во всём";
    const out = scrubSensitiveText(text);
    expect(out).not.toContain("любит структуру");
  });

  it("не трогает текст, где ничего чувствительного нет", async () => {
    const { scrubSensitiveText } = await import("./monitoring");
    const text = "connect ECONNREFUSED 127.0.0.1:5432";
    expect(scrubSensitiveText(text)).toBe(text);
  });
});

describe("logError — не пишет чувствительные поля в ErrorLog (этап 10В)", () => {
  let saved: { message: string; stack: string | null; meta: unknown } | null = null;

  beforeEach(() => {
    saved = null;
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      getDb: () => ({
        errorLog: {
          create: ({ data }: { data: { message: string; stack: string | null; meta: unknown } }) => {
            saved = data;
            return Promise.resolve();
          },
        },
      }),
    }));
  });

  it("даже если пароль и профиль попали в message/stack ошибки — в базе их не будет", async () => {
    const { logError } = await import("./monitoring");
    const err = new Error('Save failed: password="hunter2", profile={"path_type":"knows_goal"}');
    err.stack = `${err.message}\n    at save (auth.ts:1:1)`;
    await logError("auth", err);
    expect(saved).not.toBeNull();
    expect(saved!.message).not.toContain("hunter2");
    expect(saved!.message).not.toContain("knows_goal");
    expect(saved!.stack).not.toContain("hunter2");
  });

  it("вырезает чувствительное и из meta, если оно туда всё-таки попало", async () => {
    const { logError } = await import("./monitoring");
    await logError("test", new Error("boom"), { note: 'answers={"1":5}', requestId: "abc-1" });
    expect(saved).not.toBeNull();
    const meta = saved!.meta as Record<string, string>;
    expect(meta.note).not.toContain('"1":5');
    expect(meta.requestId).toBe("abc-1");
  });
});
