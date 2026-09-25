// Модуль обращения к ИИ. Остальной код импортирует только отсюда и не знает, какой SDK внутри.
//
// Как добавить другого поставщика (например, OpenAI):
//   1. написать providers/openai.ts, реализующий интерфейс AiProvider (см. types.ts);
//   2. выбрать его в getAiProvider() ниже (например, по переменной окружения AI_PROVIDER);
//   3. указать его модели в MODEL_TEASER / MODEL_ROUTE / MODEL_NAVIGATOR.
// Промпты, проверка ответов, повторы, лимиты и журнал от поставщика не зависят.

import { anthropicProvider } from "./anthropic";
import { createMockProvider, MOCK_MODEL } from "./mock";
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

export function getAiProvider(mode: AiMode = getAiMode()): AiProvider {
  return mode === "live" ? anthropicProvider : mockProvider;
}

// Модель, которая пишется в журнал: в тестовом режиме — «mock», иначе — модель из настроек.
export function modelFor(mode: AiMode, configuredModel: string): string {
  return mode === "live" ? configuredModel : MOCK_MODEL;
}

export { createMockProvider, MOCK_MODEL } from "./mock";
export { AiFatalError, ZERO_USAGE } from "./types";
export type { AiProvider, AiRequest, AiResponse, TokenUsage } from "./types";
