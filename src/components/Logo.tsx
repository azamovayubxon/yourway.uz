// Логотип yourway.uz (CLAUDE.md, раздел «Дизайн»): знак-«компас» + надпись обычным текстом
// шрифтом Commissioner 800: «your» — основной текст, «way» — терракота, «.uz» — #8A8478 (крупный
// декоративный текст, поэтому контраст 3.5:1 допустим).
// Правила знака: север (терракотовый луч) всегда вверху, не вращать, не растягивать, цвета не менять.
// Пунктирное кольцо рисуется только от 40px — на меньших размерах оно превращается в «шум».

const RING_MIN_SIZE = 40;

// animated — только для экрана ожидания бесплатного результата (TeaserGenerator): кольцо медленно
// вращается, роза покачивается ±40° и возвращается на север (globals.css, .yw-compass-*). В логотипе
// знак всегда неподвижен.
export function CompassMark({
  size = 32,
  variant = "light",
  animated = false,
  className = "",
}: {
  size?: number;
  variant?: "light" | "dark";
  animated?: boolean;
  className?: string;
}) {
  const ring = size >= RING_MIN_SIZE;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={"shrink-0 " + className}
      aria-hidden
      focusable="false"
    >
      {ring && (
        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={variant === "light" ? "#1D1B16" : "#FBF7F0"}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray="0.1 8.8"
          opacity="0.5"
          className={animated ? "yw-compass-ring" : undefined}
        />
      )}
      <CompassRose variant={variant} className={animated ? "yw-compass-rose" : undefined} />
    </svg>
  );
}

// Сама роза знака (без кольца) в координатах 0–120 — для вставки внутрь другой SVG-картинки
// (иллюстрация на карточке типа, этап 2б). Правила те же: север вверху, цвета не менять.
export function CompassRose({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  const c =
    variant === "light"
      ? { n1: "#9A3412", n2: "#C2410C", a: "#5E5A52", b: "#1D1B16" }
      : { n1: "#C2410C", n2: "#F0673A", a: "#FBF7F0", b: "#BDB5A6" };
  return (
    <g className={className}>
      <path d="M60 7 L48 48 L60 60Z" fill={c.n1} />
      <path d="M60 7 L72 48 L60 60Z" fill={c.n2} />
      <path d="M96 60 L72 48 L60 60Z" fill={c.a} />
      <path d="M96 60 L72 72 L60 60Z" fill={c.b} />
      <path d="M60 96 L72 72 L60 60Z" fill={c.b} />
      <path d="M60 96 L48 72 L60 60Z" fill={c.a} />
      <path d="M24 60 L48 72 L60 60Z" fill={c.b} />
      <path d="M24 60 L48 48 L60 60Z" fill={c.a} />
    </g>
  );
}

// Надпись «yourway.uz». Экранные читалки читают её как одно слово (без разрывов на span).
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={"font-display font-extrabold tracking-tight " + className}>
      <span className="text-ink">your</span>
      <span className="text-brand-500">way</span>
      <span className="text-faint">.uz</span>
    </span>
  );
}

// Шапка и подвал: знак без кольца (меньше 40px) + надпись.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-1.5 sm:gap-2">
      <CompassMark size={size} />
      <Wordmark className="text-lg leading-none sm:text-xl" />
    </span>
  );
}
