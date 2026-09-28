import { describe, expect, it } from "vitest";
import { estimatePairCost, summarizeWins } from "./logic";

describe("сравнение моделей: сводка побед", () => {
  const pair = (one: string, two: string, verdict: string | null) => ({
    verdict,
    variants: [
      { slot: 2, model: two },
      { slot: 1, model: one },
    ],
  });

  it("считает победы, поражения и ничьи по номеру варианта", () => {
    const scores = summarizeWins([
      pair("gpt-6-sol", "claude-sonnet-5", "1"),
      pair("claude-sonnet-5", "gpt-6-sol", "1"),
      pair("claude-sonnet-5", "gpt-6-sol", "2"),
      pair("gpt-6-sol", "claude-sonnet-5", "equal"),
      // Не оценено и «модель против себя» в сводку не идут.
      pair("gpt-6-sol", "claude-sonnet-5", null),
      pair("gpt-6-sol", "gpt-6-sol", "1"),
    ]);
    expect(scores).toEqual([
      { model: "gpt-6-sol", comparisons: 4, wins: 2, losses: 1, ties: 1 },
      { model: "claude-sonnet-5", comparisons: 4, wins: 1, losses: 2, ties: 1 },
    ]);
  });
});

describe("сравнение моделей: оценка стоимости пары", () => {
  it("по ценам прайса; худший случай — оба с повтором", () => {
    const e = estimatePairCost(["gpt-6-sol", "gpt-6-astra"], { input: 10_000, output: 5_000 });
    // sol: 0.01·2 + 0.005·10 = 0.07; astra: 0.01·10 + 0.005·50 = 0.35
    expect(e.perModel[0]).toBeCloseTo(0.07, 6);
    expect(e.perModel[1]).toBeCloseTo(0.35, 6);
    expect(e.total).toBeCloseTo(0.42, 6);
    expect(e.worst).toBeCloseTo(0.84, 6);
  });

  it("неизвестная модель — стоимость не оценивается", () => {
    expect(estimatePairCost(["claude-sonnet-5", "gpt-x"], { input: 1, output: 1 }).total).toBeNull();
  });
});
