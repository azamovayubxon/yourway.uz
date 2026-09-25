// Поставщик ИИ «тестовый режим»: без ключа и без интернета отдаёт готовые ответы-образцы
// (тизер — src/lib/ai/mock-teasers.ts, части полного отчёта — src/lib/ai/mock-reports.ts).
// Проходит через те же проверки, что и ответ настоящего ИИ.

import { MOCK_REPORTS } from "../mock-reports";
import { MOCK_TEASERS } from "../mock-teasers";
import { ZERO_USAGE, type AiProvider, type AiRequest } from "./types";

// Название «модели» в журнале и в базе для тестового режима.
export const MOCK_MODEL = "mock";

// Пауза, чтобы в тестовом режиме был виден экран «анализируем ваш профиль…».
const MOCK_DELAY_MS = 2500;

// Ответ-образец на запрос. Что именно нужно, видно по request.tag: «teaser» (или пусто) —
// тизер, «report:<часть>:<тип пути>» — часть полного отчёта.
export function mockResponse(request: AiRequest): unknown {
  // Язык ответа — по строке о языке в системном промпте (как это сделал бы настоящий ИИ).
  const language = /строго на языке: uz\b/.test(request.system) ? "uz" : "ru";
  const [kind, part, pathType] = (request.tag ?? "teaser").split(":");
  if (kind !== "report") return MOCK_TEASERS[language];
  const report = MOCK_REPORTS[language];
  const variant = pathType === "no_goal" ? "constructed" : "stated";
  switch (part) {
    case "portrait_goal":
      return { portrait: report.portrait, goal: report.goal[variant], reality_check: report.reality_check[variant] };
    case "main_path":
      return report.main_path;
    default:
      return report.finish;
  }
}

export function createMockProvider(delayMs: number = MOCK_DELAY_MS): AiProvider {
  return {
    name: "mock",
    estimateCostUsd: () => 0,
    async call(request) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { text: JSON.stringify(mockResponse(request)), finish: "complete", usage: ZERO_USAGE };
    },
  };
}

// «Сломанный» поставщик для проверки сбоя генерации (служебная страница /dev/ai-fail, только вне
// боевого сайта): отвечает не-JSON, поэтому каждая попытка бракуется и отчёт уходит в «не удалось».
export function createFailingProvider(delayMs: number = MOCK_DELAY_MS): AiProvider {
  return {
    name: "mock-fail",
    estimateCostUsd: () => 0,
    async call() {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { text: "Имитация сбоя ИИ: это не JSON", finish: "complete", usage: ZERO_USAGE };
    },
  };
}
