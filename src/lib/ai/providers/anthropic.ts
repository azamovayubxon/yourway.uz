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

// Параметр effort (глубина «размышлений») принимают Sonnet 5, Opus 4.5+ и Fable; Haiku 4.5 — нет.
// У Sonnet 5 размышления включены по умолчанию на уровне high: для короткого тизера это лишние
// десятки секунд и токены, которые съедали лимит ответа (этап 4б).
export function supportsEffort(model: string): boolean {
  return /^claude-(sonnet-5|opus-(4-[5-9]|5)|fable-)/.test(model);
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
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: request.user }];
      if (request.retry) {
        messages.push(
          { role: "assistant", content: request.retry.previousResponse },
          { role: "user", content: request.retry.feedback },
        );
      }
      const outputConfig = {
        ...(request.effort && supportsEffort(request.model) ? { effort: request.effort } : {}),
        // Structured outputs: модель обязана вернуть JSON заданной формы.
        ...(request.outputSchema ? { format: zodOutputFormat(request.outputSchema) } : {}),
      };
      // Потоковый ответ (stream): полный отчёт — длинный текст, и так соединение не простаивает
      // минутами без данных (некоторые прокси такие соединения обрывают). Ждём целиком — finalMessage().
      const stream = getClient().messages.stream(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          // Системный промпт одинаков для всех пользователей (меняется только язык) — помечаем его
          // для кэширования (prompt caching). Кэш срабатывает, только если промпт длиннее минимума
          // модели; если короче, запрос просто идёт без кэша, без ошибок. TTL по умолчанию — 5 минут;
          // "1h" — когда вызывающий код знает, что до следующего вызова обычно проходит больше 5 минут.
          system: [
            {
              type: "text",
              text: request.system,
              cache_control:
                request.cacheTtl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" },
            },
          ],
          messages,
          ...(request.temperature !== undefined && supportsTemperature(request.model)
            ? { temperature: request.temperature }
            : {}),
          ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
        },
        // Лимит времени задан вызывающим кодом: тогда без скрытых повторов внутри SDK, иначе одна
        // «попытка» могла длиться вдвое дольше лимита. timeout SDK ждёт только начала ответа, поэтому
        // на весь поток целиком ставим ещё и signal.
        request.timeoutMs
          ? { timeout: request.timeoutMs, maxRetries: 0, signal: AbortSignal.timeout(request.timeoutMs) }
          : undefined,
      );
      const response = await stream.finalMessage();
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
