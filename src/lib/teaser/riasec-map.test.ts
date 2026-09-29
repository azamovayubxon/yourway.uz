import { describe, expect, it } from "vitest";
import { computeScores, type Answers } from "@/lib/assessment/scoring";
import { TESTS } from "@/lib/assessment/tests";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";
import {
  labelWidth,
  mapGeometry,
  MAP_FONT,
  MIN_SHARE,
  RIASEC_ORDER,
  riasecMapData,
  riasecShare,
  type MapGeometry,
} from "./riasec-map";

const EVEN = { R: 15, I: 15, A: 15, S: 15, E: 15, C: 15 };

describe("riasecShare: сумма 5–25 → доля для рисования", () => {
  it("границы и середина", () => {
    expect(riasecShare(25)).toBe(1);
    expect(riasecShare(15)).toBe(0.5);
    expect(riasecShare(9)).toBeCloseTo(0.2);
  });
  it("минимум 0.1, чтобы точка не сливалась с центром", () => {
    expect(riasecShare(5)).toBe(MIN_SHARE);
    expect(riasecShare(6)).toBe(MIN_SHARE);
    expect(riasecShare(0)).toBe(MIN_SHARE);
  });
  it("не больше 1", () => {
    expect(riasecShare(40)).toBe(1);
  });
});

describe("riasecMapData: две сильные вершины = две максимальные суммы", () => {
  it("выбирает два максимума", () => {
    const data = riasecMapData({ R: 8, I: 24, A: 21, S: 10, E: 12, C: 9 });
    expect(data.top).toEqual(["I", "A"]);
    expect(data.shares.I).toBeCloseTo(0.95);
  });

  it("равные суммы — порядок R→I→A→S→E→C, как у кода RIASEC в движке подсчёта", () => {
    expect(riasecMapData(EVEN).top).toEqual(["R", "I"]);
    expect(riasecMapData({ ...EVEN, C: 20, E: 20 }).top).toEqual(["E", "C"]);
  });

  it("совпадает с первыми двумя буквами profile.riasec.code на настоящих ответах", () => {
    // Случайные, но воспроизводимые ответы на все 110 вопросов.
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed % 5) + 1;
    };
    for (let round = 0; round < 25; round++) {
      const answers: Answers = {};
      for (const test of TESTS) answers[test.id] = Object.fromEntries(test.questions.map((q) => [q.id, next()]));
      const scores = computeScores(answers);
      const data = riasecMapData(scores.riasec.scores);
      expect(data.top.join("")).toBe(scores.riasec.code.slice(0, 2));
      // Две сильные вершины — это и правда максимумы сумм.
      const sums = Object.values(scores.riasec.scores).sort((a, b) => b - a);
      expect(scores.riasec.scores[data.top[0]]).toBe(sums[0]);
      expect(scores.riasec.scores[data.top[1]]).toBe(sums[1]);
    }
  });
});

// ─── Подписи вершин не обрезаются и не наезжают на фигуру и друг на друга ───────────────────────

type Box = { x0: number; x1: number; y0: number; y1: number };

function boxes(g: MapGeometry, names: Record<string, string>): Box[] {
  return g.labels.map((l) => {
    const w = labelWidth(names[l.type]);
    const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
    return { x0, x1: x0 + w, y0: l.y - MAP_FONT * 0.8, y1: l.y + MAP_FONT * 0.25 };
  });
}

// Пересекает ли отрезок прямоугольник (проверяем точки отрезка с мелким шагом — для теста хватает).
function segmentHitsBox([ax, ay]: [number, number], [bx, by]: [number, number], b: Box): boolean {
  for (let k = 0; k <= 200; k++) {
    const x = ax + ((bx - ax) * k) / 200;
    const y = ay + ((by - ay) * k) / 200;
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return true;
  }
  return false;
}

describe.each([
  ["uz", uz.teaser.interestMap.names],
  ["ru", ru.teaser.interestMap.names],
])("mapGeometry [%s]", (_, names) => {
  const g = mapGeometry(riasecMapData({ R: 25, I: 25, A: 25, S: 25, E: 25, C: 25 }), names);
  const bx = boxes(g, names);

  it("все шесть подписей внутри viewBox", () => {
    expect(g.labels.map((l) => l.type)).toEqual([...RIASEC_ORDER]);
    for (const b of bx) {
      expect(b.x0).toBeGreaterThanOrEqual(0);
      expect(b.x1).toBeLessThanOrEqual(g.width);
      expect(b.y0).toBeGreaterThanOrEqual(0);
      expect(b.y1).toBeLessThanOrEqual(g.height);
    }
  });

  it("подписи не пересекают стороны шестиугольника", () => {
    for (const b of bx) {
      for (let i = 0; i < 6; i++) {
        expect(segmentHitsBox(g.outer[i], g.outer[(i + 1) % 6], b)).toBe(false);
      }
    }
  });

  it("подписи не наезжают друг на друга", () => {
    for (let i = 0; i < bx.length; i++) {
      for (let j = i + 1; j < bx.length; j++) {
        const [a, b] = [bx[i], bx[j]];
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlap, `${g.labels[i].type} и ${g.labels[j].type}`).toBe(false);
      }
    }
  });

  it("фигура по баллам лежит внутри полного шестиугольника", () => {
    const small = mapGeometry(riasecMapData({ R: 5, I: 25, A: 15, S: 5, E: 10, C: 20 }), names);
    small.shape.forEach(([x, y], i) => {
      const [ox, oy] = small.outer[i];
      expect(Math.hypot(x - small.cx, y - small.cy)).toBeLessThanOrEqual(Math.hypot(ox - small.cx, oy - small.cy) + 0.2);
    });
  });
});
