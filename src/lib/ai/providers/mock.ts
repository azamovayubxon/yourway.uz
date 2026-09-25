// Поставщик ИИ «тестовый режим»: без ключа и без интернета отдаёт готовые ответы-образцы
// (src/lib/ai/mock-teasers.ts). Проходит через те же проверки, что и ответ настоящего ИИ.

import { MOCK_TEASERS } from "../mock-teasers";
import { ZERO_USAGE, type AiProvider } from "./types";

// Название «модели» в журнале и в базе для тестового режима.
export const MOCK_MODEL = "mock";

// Пауза, чтобы в тестовом режиме был виден экран «анализируем ваш профиль…».
const MOCK_DELAY_MS = 2500;

export function createMockProvider(delayMs: number = MOCK_DELAY_MS): AiProvider {
  return {
    name: "mock",
    estimateCostUsd: () => 0,
    async call(request) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      // Язык ответа — по строке о языке в системном промпте (как это сделал бы настоящий ИИ).
      const language = /строго на языке: uz\b/.test(request.system) ? "uz" : "ru";
      return { text: JSON.stringify(MOCK_TEASERS[language]), finish: "complete", usage: ZERO_USAGE };
    },
  };
}
