import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" и база не нужны: проверяем только выбор модели по переопределениям.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

const { modelSaveError, pickModel, reportModelKey } = await import("./models");

describe("модель по уровню и языку", () => {
  beforeEach(() => {
    for (const name of ["MODEL_TEASER", "MODEL_TEASER_UZ", "MODEL_ROUTE", "MODEL_NAVIGATOR"]) vi.stubEnv(name, "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("узбекский отчёт: свой ключ, если задан; пусто — модель уровня; пусто и там — окружение", () => {
    expect(pickModel(reportModelKey("route", "uz"), {})).toBe("claude-sonnet-5");
    expect(pickModel(reportModelKey("navigator", "uz"), {})).toBe("claude-opus-5-5");
    expect(pickModel(reportModelKey("route", "uz"), { report_route: "claude-opus-5" })).toBe("claude-opus-5");
    expect(
      pickModel(reportModelKey("route", "uz"), { report_route: "claude-opus-5", report_route_uz: "gpt-6-sol" }),
    ).toBe("gpt-6-sol");
    expect(pickModel(reportModelKey("navigator", "uz"), { report_navigator_uz: "  " })).toBe("claude-opus-5-5");
  });

  it("русский отчёт не видит узбекских ключей", () => {
    const overrides = { report_route_uz: "gpt-6-sol", report_navigator_uz: "gpt-6-astra" };
    expect(reportModelKey("route", "ru")).toBe("report_route");
    expect(pickModel(reportModelKey("route", "ru"), overrides)).toBe("claude-sonnet-5");
    expect(pickModel(reportModelKey("navigator", "ru"), overrides)).toBe("claude-opus-5-5");
  });

  it("тизер: teaser_uz / teaser_ru, как раньше", () => {
    expect(pickModel("teaser_uz", { teaser_uz: "gpt-6-sol" })).toBe("gpt-6-sol");
    expect(pickModel("teaser_ru", { teaser_uz: "gpt-6-sol" })).toBe("claude-haiku-4-5");
  });

  it("модель OpenAI без OPENAI_API_KEY сохранить нельзя", () => {
    expect(modelSaveError("gpt-6-sol", false)).toBe("openai_key");
    expect(modelSaveError("o4-mini", false)).toBe("openai_key");
    expect(modelSaveError("gpt-6-sol", true)).toBeNull();
    expect(modelSaveError("claude-sonnet-5", false)).toBeNull();
    // Пустое поле — сброс на значение по умолчанию, это можно всегда.
    expect(modelSaveError("", false)).toBeNull();
    expect(modelSaveError("gpt 6; drop", true)).toBe("bad_name");
  });
});
