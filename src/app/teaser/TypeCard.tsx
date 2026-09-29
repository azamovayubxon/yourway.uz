import { CompassRose } from "@/components/Logo";
import { cardTitleFontSize } from "@/components/typeTitle";

// «Коллекционная» карточка типа на странице бесплатного результата (этап 2б): бирюзовая,
// сверху мелко «ВАШ ТИП» и «YOURWAY.UZ», иллюстрация с компасом, название типа крупно и три
// сильные стороны «таблетками». Слегка покачивается (globals.css, .yw-sway; при «уменьшить
// движение» — статично). Та же карточка — в картинке «Сохранить картинку» (src/lib/og).
//
// Контраст: белый на бирюзе (#0F766E) — 5.47:1; мелкие подписи — on-teal-muted (4.95:1);
// «таблетки» — белый текст на тёмной бирюзе (teal-800, 7.8:1).
export function TypeCard({
  label,
  typeLabel,
  strengths,
  lang,
}: {
  label: string;
  typeLabel: string;
  strengths: string[];
  lang: string;
}) {
  return (
    <section aria-labelledby="type-title" className="yw-sway rounded-[32px] bg-teal p-5 text-white sm:p-6">
      <div className="[container-type:inline-size]">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-on-teal-muted">
          <p>{label}</p>
          <p aria-hidden>yourway.uz</p>
        </div>
        <TypeIllustration className="mt-3 block h-auto w-full overflow-hidden rounded-[22px]" />
        <h1
          id="type-title"
          lang={lang}
          className="mt-5 break-words font-extrabold leading-[1.04] tracking-tight"
          style={{ fontSize: cardTitleFontSize(typeLabel) }}
        >
          {typeLabel}
        </h1>
        <ul className="mt-4 flex flex-wrap gap-2" lang={lang}>
          {strengths.map((s) => (
            <li key={s} className="rounded-full bg-teal-800 px-3.5 py-1.5 text-[13px] font-bold leading-snug text-white">
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Иллюстрация: знак-компас в кремовом круге на тёмно-бирюзовом поле, вокруг — пунктирное кольцо,
// «солнце», два крестика и пунктирная тропинка (декор, только aria-hidden).
export function TypeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 150" className={className} aria-hidden focusable="false">
      <rect width="320" height="150" className="fill-teal-800" />
      <circle cx="270" cy="36" r="17" className="fill-sun" />
      <g className="stroke-sun" strokeWidth="3" strokeLinecap="round">
        <path d="M44 34 l10 10 M54 34 l-10 10" />
        <path d="M252 104 l10 10 M262 104 l-10 10" />
      </g>
      <path
        d="M34 118 C 62 96, 84 124, 112 106"
        fill="none"
        className="stroke-sun"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="0.1 8"
      />
      <circle
        cx="160"
        cy="75"
        r="56"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.55"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="0.1 8.4"
      />
      <circle cx="160" cy="75" r="36" className="fill-app-bg" />
      <svg x="132" y="47" width="56" height="56" viewBox="0 0 120 120">
        <CompassRose />
      </svg>
    </svg>
  );
}
