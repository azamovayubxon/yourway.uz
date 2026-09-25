// Общий интерфейс «поставщика ИИ». Остальной код (тизер, полный отчёт) знает только его,
// а не конкретный SDK. Чтобы подключить другого поставщика (например, OpenAI), достаточно
// написать ещё один файл рядом с anthropic.ts, реализующий AiProvider, и выбрать его в index.ts.

import type { z } from "zod";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  // Токены, прочитанные из кэша промпта и записанные в него (если поставщик это поддерживает).
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AiRequest {
  model: string;
  // Неизменная часть инструкций (одинакова для всех пользователей) — поставщик может её кэшировать.
  system: string;
  // Личная часть (профиль пользователя).
  user: string;
  maxTokens: number;
  // Поставщик сам решает, может ли модель принять этот параметр; если нет — не передаёт.
  temperature?: number;
  // Ожидаемая форма JSON-ответа. Если поставщик умеет «structured outputs» — передаёт её модели.
  // Проверку ответа всё равно делает вызывающий код (своей схемой и правилами).
  outputSchema?: z.ZodType;
  // Насколько глубоко модель «думает» перед ответом (low — быстрее и дешевле). Поставщик передаёт
  // его только моделям, которые это поддерживают.
  effort?: "low" | "medium" | "high";
  // Жёсткий лимит времени на эту попытку, мс. По истечении — ошибка, без скрытых повторов внутри.
  timeoutMs?: number;
  // Время жизни записи кэша промпта. По умолчанию 5 минут («5m», как у Anthropic); "1h" — для
  // генераций, где разрыв между вызовами (время самой генерации + опрос статуса) обычно длиннее
  // 5 минут — иначе следующий вызов не застаёт кэш живым и пишет его заново (этап 7, /dev/ai-log).
  cacheTtl?: "5m" | "1h";
  // Повторная попытка: прошлый ответ модели и сообщение, что в нём исправить.
  retry?: { previousResponse: string; feedback: string };
  // Что генерируем: teaser | report:<часть>:<тип пути>. Нужно тестовому режиму (какой образец отдать)
  // и для логов; настоящему ИИ не передаётся.
  tag?: string;
}

export interface AiResponse {
  text: string;
  usage: TokenUsage;
  // complete — ответ полный; truncated — обрезан по лимиту токенов; refused — модель отказалась отвечать.
  finish: "complete" | "truncated" | "refused";
}

export interface AiProvider {
  // anthropic | mock | ...
  name: string;
  call(request: AiRequest): Promise<AiResponse>;
  // Примерная стоимость вызова в долларах по прайсу поставщика. null — цена неизвестна.
  estimateCostUsd(model: string, usage: TokenUsage): number | null;
}

// Ошибка, после которой повторять запрос бессмысленно (неверный ключ, неизвестная модель и т. п.).
export class AiFatalError extends Error {}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
