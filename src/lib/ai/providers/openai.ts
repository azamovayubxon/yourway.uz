// Поставщик ИИ: OpenAI (Responses API). Весь код, который знает про пакет openai, — только здесь.
// Ключ берётся из переменной окружения OPENAI_API_KEY. Какие модели идут сюда, решает index.ts
// (по названию: gpt-* и o<цифра>* — OpenAI, остальное — Anthropic).

import OpenAI from "openai";
import { z } from "zod";
import { estimateOpenAiCostUsd } from "./prices";
import { AiFatalError, type AiProvider } from "./types";

// Время ожидания одного ответа, мс, и число автоматических повторов при сетевых сбоях (как в anthropic.ts).
const TIMEOUT_MS = 60_000;
const NETWORK_RETRIES = 1;

// Модели с «рассуждениями» (reasoning): GPT-5 и новее, серия o. Им передаётся reasoning.effort,
// а temperature они не принимают (отвечают ошибкой) — её не передаём. Старым моделям (gpt-4o,
// gpt-4.1) — наоборот: temperature есть, effort нет.
export function isOpenAiReasoningModel(model: string): boolean {
  return /^(o\d|gpt-([5-9]|\d{2,}))/.test(model);
}

// ───────────── Structured outputs: optional ↔ null ─────────────
//
// Строгий режим JSON-схемы OpenAI (strict: true) требует, чтобы в каждом объекте ВСЕ поля были
// в required и не было лишних полей. В наших общих схемах (тизер, отчёт report-2.0) есть
// необязательные поля (.optional()). Общие схемы не меняем — здесь, только для OpenAI:
//   1) каждое необязательное поле делаем обязательным, но допускающим null;
//   2) в ответе модели убираем такие null обратно (как будто поля нет),
// так что дальше общая проверка (схема + content-checks + uz-style) видит ровно ту форму,
// которую ждёт, и работает без изменений.

type JsonSchema = { [key: string]: unknown };

function isObjectSchema(node: JsonSchema): node is JsonSchema & { properties: Record<string, JsonSchema> } {
  return typeof node.properties === "object" && node.properties !== null;
}

function requiredOf(node: JsonSchema): string[] {
  return Array.isArray(node.required) ? (node.required as string[]) : [];
}

// JSON-схема (draft 2020-12) из zod, как её видит наш код: необязательные поля не в required.
export function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { io: "output" }) as JsonSchema;
  delete json.$schema;
  return json;
}

// Та же схема в форме для строгого режима OpenAI: все поля обязательны, необязательные — «или null».
export function toOpenAiStrictSchema(node: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...node };
  if (isObjectSchema(node)) {
    const required = new Set(requiredOf(node));
    out.properties = Object.fromEntries(
      Object.entries(node.properties).map(([key, child]) => {
        const strictChild = toOpenAiStrictSchema(child);
        return [key, required.has(key) ? strictChild : { anyOf: [strictChild, { type: "null" }] }];
      }),
    );
    out.required = Object.keys(node.properties);
    out.additionalProperties = false;
  }
  if (node.items && typeof node.items === "object") out.items = toOpenAiStrictSchema(node.items as JsonSchema);
  if (Array.isArray(node.anyOf)) out.anyOf = (node.anyOf as JsonSchema[]).map(toOpenAiStrictSchema);
  return out;
}

// Убирает из ответа null в тех полях, которые в исходной схеме необязательны. Остальное не трогает:
// если модель прислала null в обязательном поле, это увидит и отбракует общая проверка.
export function stripNullOptionals(value: unknown, node: JsonSchema): unknown {
  if (Array.isArray(value)) {
    const items = node.items && typeof node.items === "object" ? (node.items as JsonSchema) : null;
    return items ? value.map((v) => stripNullOptionals(v, items)) : value;
  }
  if (value && typeof value === "object" && isObjectSchema(node)) {
    const required = new Set(requiredOf(node));
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === null && !required.has(key) && key in node.properties) continue;
      const child = node.properties[key];
      result[key] = child ? stripNullOptionals(v, child) : v;
    }
    return result;
  }
  return value;
}

// Текст ответа → тот же текст, но без null в необязательных полях. Не JSON — возвращаем как есть
// (общая проверка отбракует его как json:invalid и попросит повтор).
export function restoreOptionals(text: string, schema: JsonSchema): string {
  try {
    return JSON.stringify(stripNullOptionals(JSON.parse(text), schema));
  } catch {
    return text;
  }
}

// ───────────── Вызов ─────────────

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    // Без ключа повторять бессмысленно — сразу «окончательная» ошибка (дальше сработает страховка на Claude).
    throw new AiFatalError("OPENAI_API_KEY не задан");
  }
  client ??= new OpenAI({ timeout: TIMEOUT_MS, maxRetries: NETWORK_RETRIES });
  return client;
}

export const openAiProvider: AiProvider = {
  name: "openai",
  estimateCostUsd: estimateOpenAiCostUsd,

  async call(request) {
    try {
      // Повтор — как в anthropic.ts: прошлый ответ модели и сообщение, что в нём исправить.
      const input: OpenAI.Responses.ResponseInputItem[] = [{ role: "user", content: request.user }];
      if (request.retry) {
        input.push(
          { role: "assistant", content: request.retry.previousResponse },
          { role: "user", content: request.retry.feedback },
        );
      }
      const reasoning = isOpenAiReasoningModel(request.model);
      const schema = request.outputSchema ? zodToJsonSchema(request.outputSchema) : null;
      // Потоковый ответ (stream), как у Anthropic: длинный отчёт не держит соединение минутами без данных.
      // Кэш промпта у OpenAI включается сам (для одинакового начала запроса), поэтому cacheTtl
      // здесь не нужен и игнорируется.
      const stream = getClient().responses.stream(
        {
          model: request.model,
          instructions: request.system,
          input,
          max_output_tokens: request.maxTokens,
          // Не храним ответы на стороне OpenAI: они нам не нужны после вызова.
          store: false,
          ...(reasoning && request.effort ? { reasoning: { effort: request.effort } } : {}),
          ...(!reasoning && request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(schema
            ? { text: { format: { type: "json_schema", name: "output", strict: true, schema: toOpenAiStrictSchema(schema) } } }
            : {}),
        },
        request.timeoutMs
          ? { timeout: request.timeoutMs, maxRetries: 0, signal: AbortSignal.timeout(request.timeoutMs) }
          : undefined,
      );
      const response = await stream.finalResponse();

      let text = "";
      let refused = false;
      for (const item of response.output) {
        if (item.type !== "message") continue;
        for (const part of item.content) {
          if (part.type === "output_text") text += part.text;
          else if (part.type === "refusal") refused = true;
        }
      }
      const incomplete = response.status === "incomplete" ? response.incomplete_details?.reason : undefined;
      const finish =
        refused || incomplete === "content_filter"
          ? "refused"
          : incomplete === "max_output_tokens" || response.status === "incomplete"
            ? "truncated"
            : "complete";

      // У OpenAI input_tokens включает и токены из кэша: считаем «обычный» вход без них,
      // чтобы журнал и оценка стоимости совпадали по смыслу с Anthropic.
      const usage = response.usage;
      const cacheReadTokens = usage?.input_tokens_details?.cached_tokens ?? 0;
      const cacheWriteTokens = usage?.input_tokens_details?.cache_write_tokens ?? 0;
      return {
        text: schema && finish === "complete" ? restoreOptionals(text, schema) : text,
        finish,
        usage: {
          inputTokens: Math.max(0, (usage?.input_tokens ?? 0) - cacheReadTokens - cacheWriteTokens),
          outputTokens: usage?.output_tokens ?? 0,
          cacheReadTokens,
          cacheWriteTokens,
        },
      };
    } catch (error) {
      if (
        error instanceof OpenAI.AuthenticationError ||
        error instanceof OpenAI.PermissionDeniedError ||
        error instanceof OpenAI.NotFoundError ||
        error instanceof OpenAI.BadRequestError
      ) {
        throw new AiFatalError(`${error.constructor.name}: ${error.message}`);
      }
      throw error;
    }
  },
};
