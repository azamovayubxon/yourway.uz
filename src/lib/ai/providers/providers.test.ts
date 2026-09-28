import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateAnthropicCostUsd, supportsEffort, supportsTemperature } from "./anthropic";
import { getAiMode, getAiProvider, isOpenAiModel, modelFor, providerForModel } from "./index";
import { claudeFallbackReportModel, claudeFallbackTeaserModel, reportModel, teaserModel } from "../config";

describe("выбор режима ИИ", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("без ключа — всегда тестовый режим", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_MODE", "live");
    expect(getAiMode()).toBe("mock");
    expect(getAiProvider().name).toBe("mock");
  });

  it("с ключом — настоящий ИИ, если режим явно не mock", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("AI_MODE", "");
    expect(getAiMode()).toBe("live");
    expect(getAiProvider().name).toBe("anthropic");
    vi.stubEnv("AI_MODE", "mock");
    expect(getAiMode()).toBe("mock");
  });

  it("без ключа Anthropic — тестовый режим, даже если есть ключ OpenAI (режим mock не меняется)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-openai");
    expect(getAiMode()).toBe("mock");
    expect(getAiProvider(getAiMode(), "gpt-6-sol").name).toBe("mock");
  });

  it("в журнал в тестовом режиме пишется модель mock", () => {
    expect(modelFor("mock", "claude-haiku-4-5")).toBe("mock");
    expect(modelFor("live", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });
});

describe("Anthropic: параметры и цена", () => {
  it("temperature передаётся только моделям, которые его принимают", () => {
    expect(supportsTemperature("claude-haiku-4-5")).toBe(true);
    expect(supportsTemperature("claude-sonnet-4-6")).toBe(true);
    expect(supportsTemperature("claude-opus-4-6")).toBe(true);
    expect(supportsTemperature("claude-opus-4-8")).toBe(false);
    expect(supportsTemperature("claude-sonnet-5")).toBe(false);
    expect(supportsTemperature("claude-opus-5-5")).toBe(false);
  });

  it("effort (глубина размышлений) передаётся только моделям, которые его принимают", () => {
    expect(supportsEffort("claude-sonnet-5")).toBe(true);
    expect(supportsEffort("claude-opus-5-5")).toBe(true);
    expect(supportsEffort("claude-opus-4-8")).toBe(true);
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(supportsEffort("claude-sonnet-4-6")).toBe(false);
  });

  it("считает примерную стоимость с учётом кэша", () => {
    // Haiku 4.5: $1 вход, $5 выход за 1 млн токенов.
    const usage = { inputTokens: 2000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateAnthropicCostUsd("claude-haiku-4-5", usage)).toBeCloseTo(0.007, 6);
    const cached = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };
    expect(estimateAnthropicCostUsd("claude-haiku-4-5", cached)).toBeCloseTo(0.1 + 1.25, 6);
    expect(estimateAnthropicCostUsd("unknown-model", usage)).toBeNull();
  });
});

describe("модель тизера по языку", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("для узбекского — MODEL_TEASER_UZ (по умолчанию claude-sonnet-5), для русского — MODEL_TEASER", () => {
    vi.stubEnv("MODEL_TEASER", "");
    vi.stubEnv("MODEL_TEASER_UZ", "");
    expect(teaserModel("ru")).toBe("claude-haiku-4-5");
    expect(teaserModel("uz")).toBe("claude-sonnet-5");
    vi.stubEnv("MODEL_TEASER", "model-ru");
    vi.stubEnv("MODEL_TEASER_UZ", "model-uz");
    expect(teaserModel("ru")).toBe("model-ru");
    expect(teaserModel("uz")).toBe("model-uz");
  });
});

describe("модели полного отчёта", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("«Маршрут» — MODEL_ROUTE (по умолчанию Sonnet 5), «Навигатор» — MODEL_NAVIGATOR (по умолчанию Opus 5.5)", () => {
    vi.stubEnv("MODEL_ROUTE", "");
    vi.stubEnv("MODEL_NAVIGATOR", "");
    expect(reportModel("route")).toBe("claude-sonnet-5");
    expect(reportModel("navigator")).toBe("claude-opus-5-5");
    vi.stubEnv("MODEL_NAVIGATOR", "claude-opus-5");
    expect(reportModel("navigator")).toBe("claude-opus-5");
  });
});

describe("выбор поставщика по названию модели", () => {
  it("gpt-* и o<цифра>* → OpenAI, claude-* → Anthropic", () => {
    for (const m of ["gpt-6-sol", "gpt-6-astra", "gpt-4.1", "o3", "o4-mini"]) {
      expect(isOpenAiModel(m), m).toBe(true);
      expect(providerForModel(m).name, m).toBe("openai");
    }
    for (const m of ["claude-sonnet-5", "claude-opus-5-5", "claude-haiku-4-5", "opus", "other"]) {
      expect(isOpenAiModel(m), m).toBe(false);
      expect(providerForModel(m).name, m).toBe("anthropic");
    }
  });

  it("настоящий ИИ — по модели; тестовый режим — всегда заглушка", () => {
    expect(getAiProvider("live", "gpt-6-sol").name).toBe("openai");
    expect(getAiProvider("live", "claude-sonnet-5").name).toBe("anthropic");
    // Без модели — Anthropic, как было до подключения OpenAI.
    expect(getAiProvider("live").name).toBe("anthropic");
    expect(getAiProvider("mock", "gpt-6-sol").name).toBe("mock");
  });
});

describe("страховка: Claude-модель по умолчанию", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("берёт модель из окружения, если это Claude, иначе встроенную", () => {
    vi.stubEnv("MODEL_ROUTE", "");
    vi.stubEnv("MODEL_NAVIGATOR", "claude-opus-5");
    vi.stubEnv("MODEL_TEASER_UZ", "gpt-6-sol");
    expect(claudeFallbackReportModel("route")).toBe("claude-sonnet-5");
    expect(claudeFallbackReportModel("navigator")).toBe("claude-opus-5");
    expect(claudeFallbackTeaserModel("uz")).toBe("claude-sonnet-5");
    vi.stubEnv("MODEL_ROUTE", "gpt-6-astra");
    expect(claudeFallbackReportModel("route")).toBe("claude-sonnet-5");
  });
});
