// «Карта ваших интересов» на странице бесплатного результата (этап 2б): шестиугольник RIASEC по
// реальным баллам профиля (profile.riasec.scores). Чистые функции без базы и React — их проверяет
// src/lib/teaser/riasec-map.test.ts.
//
// Правило UX-16 (аудит): пользователю НЕ показываем чисел, процентов и «выше/ниже среднего» —
// только форму фигуры и две самые сильные вершины. Поэтому наружу отсюда идут только доли 0.1–1
// для рисования и список двух сильных типов.

import { rankByScore } from "@/lib/assessment/scoring";

// Порядок вершин по часовой стрелке, начиная сверху, — классический шестиугольник Холланда
// R→I→A→S→E→C (соседние типы похожи). Он же — порядок при равных суммах (как в движке подсчёта).
export const RIASEC_ORDER = ["R", "I", "A", "S", "E", "C"] as const;
export type RiasecType = (typeof RIASEC_ORDER)[number];

// У каждой шкалы 5 вопросов по 1–5: сумма 5–25.
const RAW_MIN = 5;
const RAW_MAX = 25;
// Минимальная доля: иначе точка слабой шкалы сливается с центром и фигура «ломается».
export const MIN_SHARE = 0.1;

export interface RiasecMapData {
  // Доля 0.1–1 для каждой вершины (только для рисования, пользователю не показывается).
  shares: Record<RiasecType, number>;
  // Две самые сильные вершины — те же, что первые две буквы profile.riasec.code.
  top: [RiasecType, RiasecType];
}

export function riasecShare(raw: number): number {
  const share = (raw - RAW_MIN) / (RAW_MAX - RAW_MIN);
  return Math.min(1, Math.max(MIN_SHARE, share));
}

export function riasecMapData(scores: Record<string, number>): RiasecMapData {
  const shares = {} as Record<RiasecType, number>;
  for (const type of RIASEC_ORDER) shares[type] = riasecShare(scores[type] ?? RAW_MIN);
  // Равные суммы — порядок R→I→A→S→E→C, как у кода RIASEC в профиле (scoring.ts).
  const [first, second] = rankByScore(
    Object.fromEntries(RIASEC_ORDER.map((type) => [type, scores[type] ?? RAW_MIN])),
    [...RIASEC_ORDER],
  ) as RiasecType[];
  return { shares, top: [first, second] };
}

// ─── Геометрия SVG ─────────────────────────────────────────────────────────────────────────────
// viewBox 300 единиц в ширину; на телефоне 375px карточка ≈ 300–310px, то есть 1 единица ≈ 1px
// и подпись 12 единиц ≈ 12px. Длинные русские подписи («Предпринимательский») не помещаются сбоку
// от вершины на такой ширине, поэтому боковые подписи прижимаются к краю viewBox и поднимаются
// (верхние) или опускаются (нижние) ровно настолько, чтобы не наезжать на стороны шестиугольника.

export const MAP_WIDTH = 300;
export const MAP_FONT = 12;
const RADIUS = 88;
const EDGE = 2; // отступ подписи от края viewBox
const GAP = 7; // отступ подписи от вершины
const ASCENT = MAP_FONT * 0.8;
const DESCENT = MAP_FONT * 0.25;
// Ширина подписи — с запасом (жирная кириллица Onest ≈ 0.6 кегля на букву), чтобы не обрезалась.
export function labelWidth(label: string): number {
  return label.length * MAP_FONT * 0.64;
}

export interface MapLabel {
  type: RiasecType;
  x: number;
  y: number; // базовая линия
  anchor: "start" | "middle" | "end";
}

export interface MapGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
  // Вершины полного шестиугольника (доля 1) и фигуры по баллам — в порядке RIASEC_ORDER.
  outer: [number, number][];
  shape: [number, number][];
  labels: MapLabel[];
}

function vertex(cx: number, cy: number, r: number, i: number): [number, number] {
  const angle = -Math.PI / 2 + (i * Math.PI) / 3;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export function mapGeometry(data: RiasecMapData, names: Record<RiasecType, string>): MapGeometry {
  const r = RADIUS;
  const cx = MAP_WIDTH / 2;
  // Считаем от cy = 0, потом сдвигаем всё вниз так, чтобы верхняя подпись поместилась.
  const outer0 = RIASEC_ORDER.map((_, i) => vertex(cx, 0, r, i));
  const labels0: MapLabel[] = [];
  const slope = Math.tan(Math.PI / 6); // наклон верхних и нижних сторон шестиугольника

  // Сначала боковые подписи (i = 1, 2, 4, 5): им нужно больше всего места.
  RIASEC_ORDER.forEach((type, i) => {
    if (i === 0 || i === 3) return;
    const [vx, vy] = outer0[i];
    const w = labelWidth(names[type]);
    const right = i < 3;
    const upper = i === 1 || i === 5;
    // Левый край подписи: сбоку от вершины, но не дальше края viewBox.
    const x0 = right ? Math.min(vx + GAP, MAP_WIDTH - EDGE - w) : Math.max(vx - GAP - w, EDGE);
    // Ближайшая к центру точка подписи по горизонтали — там сторона шестиугольника ближе всего.
    const inner = right ? x0 : x0 + w;
    const intoShape = right ? Math.max(0, vx - inner) : Math.max(0, inner - vx);
    let y: number;
    if (upper) {
      // Низ подписи — выше верхней стороны в точке inner и выше самой вершины.
      const edgeY = vy - intoShape * slope;
      y = Math.min(vy - GAP, edgeY - 3) - DESCENT;
    } else {
      const edgeY = vy + intoShape * slope;
      y = Math.max(vy + GAP, edgeY + 3) + ASCENT;
    }
    labels0.push(right ? { type, x: x0, y, anchor: "start" } : { type, x: x0 + w, y, anchor: "end" });
  });

  // Верхняя и нижняя подписи — по центру; если боковая подпись заходит под них по горизонтали,
  // отодвигаем их дальше от фигуры, чтобы строки не наезжали друг на друга.
  const span = (l: MapLabel) => {
    const w = labelWidth(names[l.type]);
    const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
    return [x0, x0 + w];
  };
  const overlapsX = (a: MapLabel, b: MapLabel) => {
    const [a0, a1] = span(a);
    const [b0, b1] = span(b);
    return a0 < b1 && b0 < a1;
  };
  const lineGap = ASCENT + DESCENT + 3;
  const topLabel: MapLabel = { type: RIASEC_ORDER[0], x: cx, y: outer0[0][1] - GAP - DESCENT, anchor: "middle" };
  const bottomLabel: MapLabel = { type: RIASEC_ORDER[3], x: cx, y: outer0[3][1] + GAP + ASCENT + 4, anchor: "middle" };
  for (const side of labels0) {
    if (overlapsX(side, topLabel)) topLabel.y = Math.min(topLabel.y, side.y - lineGap);
    if (overlapsX(side, bottomLabel)) bottomLabel.y = Math.max(bottomLabel.y, side.y + lineGap);
  }
  labels0.unshift(topLabel);
  labels0.splice(3, 0, bottomLabel);

  const top = Math.min(...labels0.map((l) => l.y - ASCENT));
  const bottom = Math.max(...labels0.map((l) => l.y + DESCENT));
  const shift = EDGE - top;
  const cy = shift;
  const round = (n: number) => Math.round(n * 10) / 10;
  const outer = outer0.map(([x, y]) => [round(x), round(y + shift)] as [number, number]);
  const shape = RIASEC_ORDER.map((type, i) => {
    const [x, y] = vertex(cx, cy, r * data.shares[type], i);
    return [round(x), round(y)] as [number, number];
  });
  return {
    width: MAP_WIDTH,
    height: Math.ceil(bottom + shift + EDGE),
    cx,
    cy: round(cy),
    radius: r,
    outer,
    shape,
    labels: labels0.map((l) => ({ ...l, x: round(l.x), y: round(l.y + shift) })),
  };
}
