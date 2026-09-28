// Модуль обращения к ИИ. Остальной код импортирует только отсюда и не знает, какой SDK внутри.
//
// Два поставщика: Anthropic (anthropic.ts, модели claude-*) и OpenAI (openai.ts, модели gpt-* и o*).
// Поставщик выбирается по названию модели (providerForModel), модель — в настройках
// (переменные окружения MODEL_* или /admin/prompts). Промпты, проверка ответов, повторы, лимиты
// и журнал от поставщика не зависят.

import { anthropicProvider } from "./anthropic";
import { createMockProvider, MOCK_MODEL } from "./mock";
import { openAiProvider } from "./openai";
import type { AiProvider } from "./types";

export type AiMode = "mock" | "live";

// Режим ИИ. Настоящий ИИ включается, только если задан ключ ANTHROPIC_API_KEY
// и режим явно не выключен (AI_MODE=mock). Без ключа всегда тестовый режим.
export function getAiMode(): AiMode {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "mock";
  return process.env.AI_MODE?.trim() === "mock" ? "mock" : "live";
}

const mockProvider = createMockProvider();

// Модель OpenAI: gpt-* или серия o (o3, o4-mini, …). Всё остальное (claude-*) — Anthropic.
export function isOpenAiModel(model: string): boolean {
  return /^(gpt-|o\d)/i.test(model.trim());
}

export function providerForModel(model: string): AiProvider {
  return isOpenAiModel(model) ? openAiProvider : anthropicProvider;
}

// Поставщик для вызова: в тестовом режиме — всегда заглушка (без ключей и без интернета),
// иначе — по названию модели (без модели — Anthropic, как было до подключения OpenAI).
export function getAiProvider(mode: AiMode = getAiMode(), model?: string): AiProvider {
  if (mode !== "live") return mockProvider;
  return model ? providerForModel(model) : anthropicProvider;
}

// Есть ли ключ OpenAI в окружении (без него модели gpt-* выбрать в админке нельзя).
export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

// Модель, которая пишется в журнал: в тестовом режиме — «mock», иначе — модель из настроек.
export function modelFor(mode: AiMode, configuredModel: string): string {
  return mode === "live" ? configuredModel : MOCK_MODEL;
}

export { createFailingProvider, createMockProvider, MOCK_MODEL, mockReportPart } from "./mock";
export { AiFatalError, ZERO_USAGE } from "./types";
export type { AiProvider, AiRequest, AiResponse, TokenUsage } from "./types";
