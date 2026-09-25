// Поставщик ИИ: Claude API (Anthropic). Весь код, который знает про @anthropic-ai/sdk, — только здесь.
// Ключ берётся из переменной окружения ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiFatalError, type AiProvider, type TokenUsage } from "./types";

// Время ожидания одного ответа, мс, и число автоматических повторов при сетевых сбоях.
const TIMEOUT_MS = 60_000;
const NETWORK_RETRIES = 1;

// Цены моделей, $ за 1 млн токенов (прайс Anthropic, сентябрь 2026). Нужны только для примерной
// оценки себестоимости в журнале. Запись в кэш стоит 1,25 от цены входа, чтение из кэша — 0,1.
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

export function estimateAnthropicCostUsd(model: string, usage: TokenUsage): number | null {
  const price = PRICES_PER_MTOK[model];
  if (!price) return null;
  const usd =
    (usage.inputTokens * price.input +
      usage.cacheWriteTokens * price.input * 1.25 +
      usage.cacheReadTokens * price.input * 0.1 +
      usage.outputTokens * price.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

// Параметр temperature принимают только старые модели (Haiku, Sonnet 4.x, Opus до 4.6 включительно).
// Новые (Sonnet 5, Opus 4.7+ и 5.x) отвечают на него ошибкой, поэтому им его не передаём.
export function supportsTemperature(model: string): boolean {
  return /^claude-(haiku-|sonnet-4-|3-|opus-4-[0-6](?!\d))/.test(model);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: NETWORK_RETRIES });
  return client;
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  estimateCostUsd: estimateAnthropicCostUsd,

  async call(request) {
    try {
      const response = await getClient().messages.create({
        model: request.model,
        max_tokens: request.maxTokens,
        // Системный промпт одинаков для всех пользователей (меняется только язык) — помечаем его
        // для кэширования (prompt caching). Кэш срабатывает, только если промпт длиннее минимума
        // модели (у Haiku 4.5 — 4096 токенов); если короче, запрос просто идёт без кэша, без ошибок.
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: request.user }],
        ...(request.temperature !== undefined && supportsTemperature(request.model)
          ? { temperature: request.temperature }
          : {}),
        // Structured outputs: модель обязана вернуть JSON заданной формы.
        ...(request.outputSchema ? { output_config: { format: zodOutputFormat(request.outputSchema) } } : {}),
      });
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return {
        text,
        finish:
          response.stop_reason === "max_tokens"
            ? "truncated"
            : response.stop_reason === "refusal"
              ? "refused"
              : "complete",
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (error) {
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError ||
        error instanceof Anthropic.NotFoundError ||
        error instanceof Anthropic.BadRequestError
      ) {
        throw new AiFatalError(`${error.constructor.name}: ${error.message}`);
      }
      throw error;
    }
  },
};
