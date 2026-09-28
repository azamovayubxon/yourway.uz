import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { GOLDEN_PROFILE, GOLDEN_PROFILE_NO_GOAL } from "../golden-profile";
import { MOCK_TEASERS } from "../mock-teasers";
import { REPORT_PARTS } from "../prompts";
import { REPORT_PART_OUTPUT_SCHEMAS, validateReportPart } from "../report-schema";
import { TeaserOutputSchema, validateTeaser } from "../teaser-schema";
import { getUzGlossary } from "../uz-resources";
import { mockReportPart } from "./mock";
import {
  isOpenAiReasoningModel,
  openAiProvider,
  restoreOptionals,
  toOpenAiStrictSchema,
  zodToJsonSchema,
} from "./openai";
import { estimateOpenAiCostUsd } from "./prices";
import { AiFatalError } from "./types";

// Поддельный пакет openai: без сети запоминаем параметры запроса и отдаём заданный ответ.
const fake = vi.hoisted(() => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class NotFoundError extends APIError {}
  class BadRequestError extends APIError {}
  const state = {
    params: null as Record<string, unknown> | null,
    response: null as unknown,
    error: null as Error | null,
  };
  class OpenAI {
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static BadRequestError = BadRequestError;
    responses = {
      stream: (params: Record<string, unknown>) => {
        state.params = params;
        return {
          finalResponse: async () => {
            if (state.error) throw state.error;
            return state.response;
          },
        };
      },
    };
  }
  return { OpenAI, state, AuthenticationError, NotFoundError };
});
vi.mock("openai", () => ({ default: fake.OpenAI }));

type JsonSchema = Record<string, unknown>;

// Как ответил бы OpenAI в строгом режиме: каждое отсутствующее необязательное поле — null.
function withNulls(value: unknown, node: JsonSchema): unknown {
  if (Array.isArray(value)) return value.map((v) => withNulls(v, node.items as JsonSchema));
  if (value && typeof value === "object" && node.properties) {
    const props = node.properties as Record<string, JsonSchema>;
    return Object.fromEntries(Object.keys(props).map((key) => [key, key in value ? withNulls((value as Record<string, unknown>)[key], props[key]) : null]));
  }
  return value;
}

// Все объекты строгой схемы: все поля в required, лишних полей нет.
function checkStrict(node: JsonSchema, path = "$"): string[] {
  const errors: string[] = [];
  if (node.properties) {
    const keys = Object.keys(node.properties as object).sort();
    if (JSON.stringify([...(node.required as string[])].sort()) !== JSON.stringify(keys)) errors.push(`${path}: required`);
    if (node.additionalProperties !== false) errors.push(`${path}: additionalProperties`);
    for (const [k, v] of Object.entries(node.properties as Record<string, JsonSchema>)) errors.push(...checkStrict(v, `${path}.${k}`));
  }
  if (node.items) errors.push(...checkStrict(node.items as JsonSchema, `${path}[]`));
  if (Array.isArray(node.anyOf)) (node.anyOf as JsonSchema[]).forEach((n, i) => errors.push(...checkStrict(n, `${path}|${i}`)));
  return errors;
}

const SCHEMAS: [string, z.ZodType][] = [
  ["teaser", TeaserOutputSchema],
  ...REPORT_PARTS.map((p) => [p, REPORT_PART_OUTPUT_SCHEMAS[p]] as [string, z.ZodType]),
];

describe("OpenAI: строгая JSON-схема из общих схем тизера и отчёта", () => {
  for (const [name, schema] of SCHEMAS) {
    it(`${name}: все поля обязательны, лишних нет`, () => {
      expect(checkStrict(toOpenAiStrictSchema(zodToJsonSchema(schema)))).toEqual([]);
    });
  }

  it("необязательные поля становятся «обязательными, но допускающими null»", () => {
    const strict = toOpenAiStrictSchema(zodToJsonSchema(TeaserOutputSchema)) as {
      properties: Record<string, JsonSchema>;
    };
    expect(strict.properties.free_step).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(strict.properties.portrait).toEqual({ type: "string" });
    const finish = toOpenAiStrictSchema(zodToJsonSchema(REPORT_PART_OUTPUT_SCHEMAS.finish)) as {
      properties: Record<string, JsonSchema>;
    };
    expect(finish.properties.takeaway).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect((finish.properties.plan_30_days.anyOf as JsonSchema[])[1]).toEqual({ type: "null" });
  });
});

describe("OpenAI: null → «поля нет» перед общей проверкой", () => {
  const glossary = getUzGlossary();

  it("тизер без необязательных полей: null убираются, проверка проходит как у Claude", () => {
    const schema = zodToJsonSchema(TeaserOutputSchema);
    for (const locale of ["ru", "uz"] as const) {
      const original = structuredClone(MOCK_TEASERS[locale]) as Record<string, unknown>;
      delete original.free_step;
      for (const d of original.fitting_directions as Record<string, unknown>[]) delete d.trial_task;
      const fromOpenAi = JSON.stringify(withNulls(original, schema));
      expect(fromOpenAi).toContain('"free_step":null');
      const restored = JSON.parse(restoreOptionals(fromOpenAi, schema));
      expect(restored).toEqual(original);
      expect(validateTeaser(restored, locale, glossary)).toMatchObject({ ok: true });
      // Без восстановления общая схема отбраковала бы ответ (null — не строка).
      expect(validateTeaser(JSON.parse(fromOpenAi), locale, glossary).ok).toBe(false);
    }
  });

  for (const profile of [GOLDEN_PROFILE, GOLDEN_PROFILE_NO_GOAL]) {
    for (const part of REPORT_PARTS) {
      it(`отчёт, ${profile.path_type}, ${part}: без необязательных полей report-2.0`, () => {
        const schema = zodToJsonSchema(REPORT_PART_OUTPUT_SCHEMAS[part]);
        const original = structuredClone(mockReportPart("uz", part, profile.path_type)) as Record<string, unknown>;
        // Убираем все необязательные поля report-2.0 — так ответила бы старая версия промпта.
        if (part === "main_path") {
          const mp = original.main_path as Record<string, unknown>;
          delete mp.limitations;
          for (const r of mp.routes as Record<string, unknown>[]) delete r.what_to_check;
        }
        if (part === "finish") {
          delete original.plan_30_days;
          delete original.takeaway;
        }
        const fromOpenAi = JSON.stringify(withNulls(original, schema));
        const restored = JSON.parse(restoreOptionals(fromOpenAi, schema));
        expect(restored).toEqual(original);
        const checked = validateReportPart(part, restored, {
          language: "uz",
          pathType: profile.path_type,
          level: profile.level,
          uzRules: glossary,
        });
        expect(checked.ok ? [] : checked.problems).toEqual([]);
      });
    }
  }

  it("null в обязательном поле не прячется — его отбракует общая проверка", () => {
    const schema = zodToJsonSchema(TeaserOutputSchema);
    const restored = JSON.parse(restoreOptionals(JSON.stringify({ ...MOCK_TEASERS.ru, portrait: null }), schema));
    expect(restored.portrait).toBeNull();
    expect(validateTeaser(restored, "ru").ok).toBe(false);
  });

  it("не-JSON отдаётся как есть", () => {
    expect(restoreOptionals("не json", zodToJsonSchema(TeaserOutputSchema))).toBe("не json");
  });
});

describe("OpenAI: вызов через Responses API", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    fake.state.params = null;
    fake.state.error = null;
    fake.state.response = {
      status: "completed",
      incomplete_details: null,
      output: [{ type: "message", content: [{ type: "output_text", text: '{"a":"x","b":null}' }] }],
      usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 600, cache_write_tokens: 0 }, output_tokens: 200 },
    };
  });
  afterEach(() => vi.unstubAllEnvs());

  const request = {
    model: "gpt-6-sol",
    system: "SYSTEM",
    user: "USER",
    maxTokens: 8000,
    temperature: 0.7,
    effort: "low" as const,
    cacheTtl: "1h" as const,
    outputSchema: TeaserOutputSchema,
  };

  it("модели с рассуждениями: effort → reasoning.effort, temperature не передаётся, строгая схема", async () => {
    await openAiProvider.call(request);
    const p = fake.state.params!;
    expect(p.model).toBe("gpt-6-sol");
    expect(p.instructions).toBe("SYSTEM");
    expect(p.max_output_tokens).toBe(8000);
    expect(p.reasoning).toEqual({ effort: "low" });
    expect(p).not.toHaveProperty("temperature");
    // Кэш у OpenAI автоматический: ни TTL, ни других параметров кэша не передаём.
    expect(JSON.stringify(p)).not.toContain("1h");
    const format = (p.text as { format: Record<string, unknown> }).format;
    expect(format).toMatchObject({ type: "json_schema", strict: true });
    expect(checkStrict(format.schema as JsonSchema)).toEqual([]);
  });

  it("старые модели без рассуждений получают temperature, но не effort", async () => {
    await openAiProvider.call({ ...request, model: "gpt-4.1" });
    expect(fake.state.params!.temperature).toBe(0.7);
    expect(fake.state.params).not.toHaveProperty("reasoning");
  });

  it("повтор — прошлый ответ и подсказка сообщениями, как у Anthropic", async () => {
    await openAiProvider.call({ ...request, retry: { previousResponse: "PREV", feedback: "FIX" } });
    expect(fake.state.params!.input).toEqual([
      { role: "user", content: "USER" },
      { role: "assistant", content: "PREV" },
      { role: "user", content: "FIX" },
    ]);
  });

  it("токены: cached_tokens → cacheReadTokens, вход без кэша", async () => {
    const res = await openAiProvider.call({ ...request, outputSchema: undefined });
    expect(res.finish).toBe("complete");
    expect(res.usage).toEqual({ inputTokens: 400, outputTokens: 200, cacheReadTokens: 600, cacheWriteTokens: 0 });
  });

  it("обрезка по лимиту → truncated, отказ → refused", async () => {
    fake.state.response = { ...(fake.state.response as object), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } };
    expect((await openAiProvider.call(request)).finish).toBe("truncated");
    fake.state.response = {
      ...(fake.state.response as object),
      status: "completed",
      incomplete_details: null,
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
    };
    expect((await openAiProvider.call(request)).finish).toBe("refused");
  });

  it("неверный ключ, неизвестная модель, нет ключа → AiFatalError", async () => {
    fake.state.error = new fake.AuthenticationError("bad key");
    await expect(openAiProvider.call(request)).rejects.toBeInstanceOf(AiFatalError);
    fake.state.error = new fake.NotFoundError("no model");
    await expect(openAiProvider.call(request)).rejects.toBeInstanceOf(AiFatalError);
    fake.state.error = new Error("network");
    await expect(openAiProvider.call(request)).rejects.not.toBeInstanceOf(AiFatalError);
    vi.stubEnv("OPENAI_API_KEY", "");
    fake.state.error = null;
    await expect(openAiProvider.call(request)).rejects.toBeInstanceOf(AiFatalError);
  });
});

describe("OpenAI: модели и цены", () => {
  it("рассуждения — у GPT-5+ и серии o", () => {
    expect(isOpenAiReasoningModel("gpt-6-sol")).toBe(true);
    expect(isOpenAiReasoningModel("gpt-6-astra")).toBe(true);
    expect(isOpenAiReasoningModel("gpt-5.6-sol")).toBe(true);
    expect(isOpenAiReasoningModel("o4-mini")).toBe(true);
    expect(isOpenAiReasoningModel("gpt-4.1")).toBe(false);
    expect(isOpenAiReasoningModel("gpt-4o")).toBe(false);
  });

  it("цена: gpt-6-astra 10/1/50, gpt-6-sol 2/0.2/10 за 1 млн токенов (вход/кэш/выход)", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 };
    expect(estimateOpenAiCostUsd("gpt-6-astra", usage)).toBeCloseTo(10 + 1 + 50, 6);
    expect(estimateOpenAiCostUsd("gpt-6-sol", usage)).toBeCloseTo(2 + 0.2 + 10, 6);
    expect(estimateOpenAiCostUsd("gpt-unknown", usage)).toBeNull();
  });
});
