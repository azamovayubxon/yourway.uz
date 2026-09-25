// Сводка для /dev/ai-log: сколько длится и стоит один полный отчёт (все части и повторы вместе).

export interface ReportCallForSummary {
  durationMs: number;
  costUsd: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface ReportCallsSummary {
  calls: number;
  totalMs: number;
  // null — у какого-то вызова цена модели неизвестна.
  costUsd: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export function summarizeReportCalls(calls: ReportCallForSummary[]): ReportCallsSummary {
  let costUsd: number | null = 0;
  const sum: ReportCallsSummary = { calls: calls.length, totalMs: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  for (const c of calls) {
    sum.totalMs += c.durationMs;
    sum.inputTokens += c.inputTokens;
    sum.outputTokens += c.outputTokens;
    sum.cacheReadTokens += c.cacheReadTokens;
    costUsd = costUsd === null || c.costUsd === null ? null : costUsd + c.costUsd;
  }
  sum.costUsd = costUsd === null ? null : Math.round(costUsd * 10_000) / 10_000;
  return sum;
}
