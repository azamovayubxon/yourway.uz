import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateAnthropicCostUsd, supportsTemperature } from "./anthropic";
import { getAiMode, getAiProvider, modelFor } from "./index";

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

  it("считает примерную стоимость с учётом кэша", () => {
    // Haiku 4.5: $1 вход, $5 выход за 1 млн токенов.
    const usage = { inputTokens: 2000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateAnthropicCostUsd("claude-haiku-4-5", usage)).toBeCloseTo(0.007, 6);
    const cached = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };
    expect(estimateAnthropicCostUsd("claude-haiku-4-5", cached)).toBeCloseTo(0.1 + 1.25, 6);
    expect(estimateAnthropicCostUsd("unknown-model", usage)).toBeNull();
  });
});
