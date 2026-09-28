// Иллюстрация первого экрана главной: фигурка «Вы» в центре тёплого круга, вокруг неё медленно
// вращается разорванное кольцо («кокон»), от неё расходятся пунктирные дорожки к плашкам направлений.
// Анимация — только CSS (классы yw-* в globals.css), при prefers-reduced-motion — статично.
// Декоративная: те же направления перечислены ниже в блоке «Направления», поэтому aria-hidden.
//
// Рисунок — SVG в координатах 500×400; плашки с текстом — обычный HTML поверх, в тех же координатах
// (в процентах), чтобы подписи на любом языке не зависели от масштаба SVG.

const W = 500;
const H = 400;
const CENTER = { x: 150, y: 196 };
// Левые края плашек и их вертикальные центры: веер вокруг фигурки.
const PILLS = [
  { x: 318, y: 44 },
  { x: 338, y: 96 },
  { x: 350, y: 148 },
  { x: 354, y: 200 },
  { x: 350, y: 252 },
  { x: 338, y: 304 },
  { x: 318, y: 356 },
];

function trackPath(to: { x: number; y: number }): string {
  const from = { x: CENTER.x + 70, y: CENTER.y }; // от края кольца
  const mid = (from.x + to.x) / 2;
  return `M${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 6} ${to.y}`;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function HeroIllustration({ you, labels }: { you: string; labels: string[] }) {
  return (
    <div aria-hidden className="relative aspect-[5/4] w-full overflow-hidden rounded-[28px] bg-sand">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" focusable="false">
        {/* Тёплый круг «дышит» */}
        <circle className="yw-breathe" cx={CENTER.x} cy={CENTER.y} r="128" fill="#F5B83D" opacity="0.42" />
        <circle cx={CENTER.x} cy={CENTER.y} r="84" fill="#F5B83D" opacity="0.28" />
        {/* Дорожки к направлениям: пунктир из точек «бежит» */}
        {PILLS.map((p, i) => (
          <path
            key={i}
            className="yw-path"
            d={trackPath(p)}
            fill="none"
            stroke="#1D1B16"
            strokeOpacity="0.55"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="0.1 5.9"
          />
        ))}
        {/* Разорванное кольцо-«кокон» вращается: 30 секунд на оборот */}
        <circle
          className="yw-ring"
          cx={CENTER.x}
          cy={CENTER.y}
          r="66"
          fill="none"
          stroke="#C2410C"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="52 20 14 20 70 30 30 24"
        />
        {/* Фигурка */}
        <circle cx={CENTER.x} cy={CENTER.y} r="40" fill="#0F766E" />
        <circle cx={CENTER.x} cy={CENTER.y - 11} r="10.5" fill="#FFFFFF" />
        <path
          d={`M${CENTER.x - 20} ${CENTER.y + 22} C ${CENTER.x - 18} ${CENTER.y + 5}, ${CENTER.x + 18} ${CENTER.y + 5}, ${CENTER.x + 20} ${CENTER.y + 22} Z`}
          fill="#FFFFFF"
        />
      </svg>
      <span
        className="absolute -translate-x-1/2 font-display text-sm font-extrabold text-ink sm:text-base"
        style={{ left: pct(CENTER.x, W), top: pct(CENTER.y + 76, H) }}
      >
        {you}
      </span>
      {labels.map((label, i) => {
        const p = PILLS[i];
        if (!p) return null;
        const tone =
          i === 0
            ? "border-teal bg-teal text-white"
            : i === labels.length - 1
              ? "border-ink bg-ink text-on-dark"
              : "border-line bg-white text-ink";
        return (
          <span
            key={i}
            className={
              "absolute -translate-y-1/2 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 sm:px-3 sm:py-1 sm:text-xs " +
              tone
            }
            style={{ left: pct(p.x, W), top: pct(p.y, H) }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
