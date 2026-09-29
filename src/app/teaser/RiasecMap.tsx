import { fmt } from "@/i18n/format";
import { mapGeometry, MAP_FONT, riasecMapData, RIASEC_ORDER, type RiasecType } from "@/lib/teaser/riasec-map";

// «Карта ваших интересов» (этап 2б): шестиугольник RIASEC по реальным баллам профиля.
// Правило UX-16: никаких чисел, процентов и «выше/ниже среднего» — только форма фигуры и две
// самые сильные вершины (терракотовым текстом и точками). Геометрия и нормализация баллов —
// src/lib/teaser/riasec-map.ts (там же тесты). SVG без библиотек; фигура «вырастает» из центра
// (.yw-grow в globals.css), при «уменьшить движение» — сразу на месте.
export function RiasecMap({
  scores,
  names,
  title,
  subtitle,
  strongest,
}: {
  scores: Record<string, number>;
  names: Record<RiasecType, string>;
  title: string;
  subtitle: string;
  // Шаблон описания для экранных читалок: «Сильнее всего выражены: {a} и {b}».
  strongest: string;
}) {
  const data = riasecMapData(scores);
  const g = mapGeometry(data, names);
  const top = new Set<RiasecType>(data.top);
  const points = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(" ");
  const ring = (k: number) =>
    points(g.outer.map(([x, y]) => [g.cx + (x - g.cx) * k, g.cy + (y - g.cy) * k] as [number, number]));

  return (
    <section className="rounded-[28px] border border-line bg-white p-4">
      <h2 className="px-1 text-xl font-extrabold leading-tight">{title}</h2>
      <p className="mt-1 px-1 text-sm leading-snug text-muted">{subtitle}</p>
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={fmt(strongest, { a: names[data.top[0]], b: names[data.top[1]] })}
        className="mx-auto mt-4 block h-auto w-full max-w-[340px] font-sans"
      >
        <g fill="none" className="stroke-line" strokeWidth="1.2">
          <polygon points={ring(1)} className="fill-app-bg" />
          <polygon points={ring(2 / 3)} />
          <polygon points={ring(1 / 3)} />
          {g.outer.map(([x, y], i) => (
            <line key={i} x1={g.cx} y1={g.cy} x2={x} y2={y} />
          ))}
        </g>
        <g className="yw-grow" style={{ transformOrigin: `${g.cx}px ${g.cy}px` }}>
          <polygon
            points={points(g.shape)}
            className="fill-brand-500/20 stroke-brand-500"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {RIASEC_ORDER.map((type, i) =>
            top.has(type) ? (
              <circle key={type} cx={g.shape[i][0]} cy={g.shape[i][1]} r="4.5" className="fill-brand-500" />
            ) : null,
          )}
        </g>
        {g.labels.map((l) => (
          <text
            key={l.type}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            fontSize={MAP_FONT}
            fontWeight={top.has(l.type) ? 700 : 600}
            className={top.has(l.type) ? "fill-brand-500" : "fill-muted"}
          >
            {names[l.type]}
          </text>
        ))}
      </svg>
    </section>
  );
}
