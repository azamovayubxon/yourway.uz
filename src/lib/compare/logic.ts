// Слепое сравнение моделей (/admin/compare) — часть без базы данных: что можно сравнивать,
// оценка стоимости пары, сводка побед. Этот файл импортируется и страницей в браузере
// (оценка стоимости пересчитывается, пока владелец вводит названия моделей), поэтому без server-only.

import { estimateCostUsd } from "@/lib/ai/providers/prices";

export type CompareKind = "teaser" | "report_route" | "report_navigator";
export type ComparePart = "portrait_goal" | "main_path" | "finish";
export type CompareProfileSource = "golden" | "golden_no_goal" | "session";
export type CompareVerdict = "1" | "2" | "equal";

export const COMPARE_KINDS: CompareKind[] = ["teaser", "report_route", "report_navigator"];
export const COMPARE_PARTS: ComparePart[] = ["portrait_goal", "main_path", "finish"];

export const COMPARE_KIND_LABELS: Record<CompareKind, string> = {
  teaser: "Тизер (узбекский)",
  report_route: "Часть отчёта «Маршрут» (узбекский)",
  report_navigator: "Часть отчёта «Навигатор» (узбекский)",
};

export const COMPARE_PART_LABELS: Record<ComparePart, string> = {
  portrait_goal: "portrait_goal — портрет, цель, проверка цели",
  main_path: "main_path — основной путь и маршруты",
  finish: "finish — обучение, будущее, альтернативы, первые шаги",
};

export const VERDICT_LABELS: Record<CompareVerdict, string> = {
  "1": "лучше Variant 1",
  "2": "лучше Variant 2",
  equal: "одинаково",
};

// Подсказки в полях выбора модели (можно ввести и любую другую).
export const SUGGESTED_MODELS = ["claude-sonnet-5", "claude-opus-5-5", "gpt-6-sol", "gpt-6-astra"];

export function isCompareKind(value: string): value is CompareKind {
  return (COMPARE_KINDS as string[]).includes(value);
}

export function isComparePart(value: string): value is ComparePart {
  return (COMPARE_PARTS as string[]).includes(value);
}

export function isVerdict(value: string): value is CompareVerdict {
  return value === "1" || value === "2" || value === "equal";
}

// ───────────── Оценка стоимости пары ─────────────

export interface TokenGuess {
  input: number;
  output: number;
}

// Примерный объём одной попытки на узбекском, если в журнале ещё нет настоящих вызовов этого вида
// (иначе страница берёт среднее по журналу). Выход — с размышлениями модели: они тоже оплачиваются.
export const DEFAULT_TOKEN_GUESS: Record<"teaser" | ComparePart, TokenGuess> = {
  teaser: { input: 9_000, output: 4_000 },
  portrait_goal: { input: 14_000, output: 7_000 },
  main_path: { input: 16_000, output: 10_000 },
  finish: { input: 17_000, output: 8_000 },
};

export interface PairEstimate {
  // Стоимость одной попытки каждой модели, $ (null — цены модели нет в прайсе).
  perModel: [number | null, number | null];
  // Обычно (одна попытка каждой) и в худшем случае (у обеих понадобился повтор: ×2).
  total: number | null;
  worst: number | null;
}

export function estimatePairCost(models: [string, string], tokens: TokenGuess): PairEstimate {
  const usage = { inputTokens: tokens.input, outputTokens: tokens.output, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const perModel = models.map((m) => estimateCostUsd(m.trim(), usage)) as [number | null, number | null];
  const total = perModel[0] === null || perModel[1] === null ? null : perModel[0] + perModel[1];
  return { perModel, total, worst: total === null ? null : total * 2 };
}

// ───────────── Сводка: какая модель сколько раз выиграла ─────────────

export interface RatedComparison {
  verdict: string | null;
  variants: { slot: number; model: string }[];
}

export interface ModelScore {
  model: string;
  comparisons: number;
  wins: number;
  losses: number;
  ties: number;
}

export function summarizeWins(rows: RatedComparison[]): ModelScore[] {
  const scores = new Map<string, ModelScore>();
  const get = (model: string) => {
    const s = scores.get(model) ?? { model, comparisons: 0, wins: 0, losses: 0, ties: 0 };
    scores.set(model, s);
    return s;
  };
  for (const row of rows) {
    if (!row.verdict || !isVerdict(row.verdict)) continue;
    const one = row.variants.find((v) => v.slot === 1);
    const two = row.variants.find((v) => v.slot === 2);
    // Модель против самой себя ничего не говорит о том, какая лучше, — в сводку не идёт.
    if (!one || !two || one.model === two.model) continue;
    const a = get(one.model);
    const b = get(two.model);
    a.comparisons++;
    b.comparisons++;
    if (row.verdict === "equal") {
      a.ties++;
      b.ties++;
    } else {
      const [winner, loser] = row.verdict === "1" ? [a, b] : [b, a];
      winner.wins++;
      loser.losses++;
    }
  }
  return [...scores.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses || x.model.localeCompare(y.model));
}
