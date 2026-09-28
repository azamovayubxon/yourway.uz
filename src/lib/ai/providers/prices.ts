// Цены моделей ИИ, $ за 1 млн токенов — только для примерной оценки себестоимости в журнале
// (/admin/ai-log) и стоимости пары в /admin/compare. Без SDK и без серверного кода, поэтому этот
// файл можно импортировать и на странице в браузере (оценка стоимости перед запуском сравнения).

import type { TokenUsage } from "./types";

interface Price {
  input: number;
  output: number;
  // Чтение из кэша и запись в кэш промпта, $ за 1 млн токенов.
  cacheRead: number;
  cacheWrite: number;
}

// Anthropic (прайс сентябрь 2026): запись в кэш стоит 1,25 от цены входа, чтение из кэша — 0,1.
function anthropicPrice(input: number, output: number): Price {
  return { input, output, cacheRead: input * 0.1, cacheWrite: input * 1.25 };
}

const ANTHROPIC_PRICES: Record<string, Price> = {
  "claude-haiku-4-5": anthropicPrice(1, 5),
  "claude-sonnet-5": anthropicPrice(2, 10),
  "claude-sonnet-4-6": anthropicPrice(3, 15),
  "claude-opus-5-5": anthropicPrice(4, 20),
  "claude-opus-5": anthropicPrice(5, 25),
  "claude-opus-4-8": anthropicPrice(5, 25),
};

// OpenAI (прайс сентябрь 2026, стандартный тариф, запрос до 272 тыс. токенов на входе):
// вход / кэш (чтение) / выход; запись в кэш — 1,25 от цены входа (поле cache_write_tokens в ответе).
const OPENAI_PRICES: Record<string, Price> = {
  "gpt-6-astra": { input: 10, cacheRead: 1, cacheWrite: 12.5, output: 50 },
  "gpt-6-sol": { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 10 },
};

function estimate(price: Price | undefined, usage: TokenUsage): number | null {
  if (!price) return null;
  const usd =
    (usage.inputTokens * price.input +
      usage.cacheWriteTokens * price.cacheWrite +
      usage.cacheReadTokens * price.cacheRead +
      usage.outputTokens * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function estimateAnthropicCostUsd(model: string, usage: TokenUsage): number | null {
  return estimate(ANTHROPIC_PRICES[model], usage);
}

export function estimateOpenAiCostUsd(model: string, usage: TokenUsage): number | null {
  return estimate(OPENAI_PRICES[model], usage);
}

// Для страниц, где поставщик заранее неизвестен (оценка пары в /admin/compare).
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  return estimate(ANTHROPIC_PRICES[model] ?? OPENAI_PRICES[model], usage);
}
