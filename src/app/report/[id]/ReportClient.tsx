"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "@/i18n/format";

// Небольшие интерактивные части страницы отчёта (новый стиль — этап 3).

type NavItem = { id: string; title: string };

// Какой раздел сейчас на экране и сколько разделов человек уже прокрутил. Считается только
// в браузере по положению разделов при прокрутке, на сервер ничего не отправляется.
//  • активный — последний раздел, чей верх поднялся выше трети экрана (иначе первый);
//  • «прочитан» — раздел, чей верх хоть раз был в верхних 60% экрана, или все, когда страница
//    докручена до конца.
function useSectionProgress(items: NavItem[]): { active: string | undefined; read: number } {
  const [active, setActive] = useState(items[0]?.id);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = window.innerHeight;
      const atEnd = window.scrollY + h >= document.documentElement.scrollHeight - 4;
      let current = items[0]?.id;
      const reached: string[] = [];
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= h * 0.35) current = item.id;
        if (top <= h * 0.6 || atEnd) reached.push(item.id);
      }
      setActive(current);
      setSeen((prev) => {
        if (reached.every((id) => prev.has(id))) return prev;
        return new Set([...prev, ...reached]);
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);
  return { active, read: seen.size };
}

// Навигация по разделам. Один компонент — две раскладки с общим состоянием:
//  • компьютер (lg) — левая колонка «Mundarija», прилипает; активный раздел — терракотовый номер
//    и мягкий фон; под списком полоса «Oʻqildi: n / total»;
//  • телефон — плавающая внизу тёмная кнопка «Boʻlimlar · n/total» (n — номер раздела, который
//    сейчас на экране), открывает список разделов над собой.
export function ReportNav({
  items,
  tocLabel,
  sectionsButton,
  readLabel,
}: {
  items: NavItem[];
  tocLabel: string;
  sectionsButton: string;
  // «Oʻqildi: {n} / {total}»
  readLabel: string;
}) {
  const { active, read } = useSectionProgress(items);
  const total = items.length;
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === active));
  const readText = fmt(readLabel, { n: read, total });

  return (
    <>
      <nav aria-label={tocLabel} className="sticky top-24 hidden self-start print:hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{tocLabel}</p>
        <ol className="mt-3 space-y-1">
          {items.map((item, i) => {
            const on = active === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={on ? "location" : undefined}
                  className={
                    "focus-ring flex items-start gap-3 rounded-2xl px-3 py-2 text-sm leading-snug transition-colors " +
                    (on ? "bg-brand-50 font-bold text-brand-700" : "text-ink hover:bg-white")
                  }
                >
                  <span className={"w-4 shrink-0 text-right font-display font-bold tabular-nums " + (on ? "text-brand-500" : "text-muted")}>
                    {i + 1}
                  </span>
                  {item.title}
                </a>
              </li>
            );
          })}
        </ol>
        <div className="mt-5 px-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={readText}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={read}
          >
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${(read / total) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted" aria-hidden>
            {readText}
          </p>
        </div>
      </nav>
      <MobileSectionsMenu items={items} label={sectionsButton} active={active} counter={`${activeIndex + 1}/${total}`} />
    </>
  );
}

// Кнопка «Разделы»/«Boʻlimlar» на телефоне (ТЗ аудита §9): плавает внизу по центру, открывает
// список разделов. Закрывается выбором раздела, повторным нажатием или клавишей Esc.
function MobileSectionsMenu({
  items,
  label,
  active,
  counter,
}: {
  items: NavItem[];
  label: string;
  active: string | undefined;
  counter: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          close();
          ref.current.querySelector("summary")?.focus();
        }
      }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 print:hidden lg:hidden"
    >
      <summary className="focus-ring-light flex min-h-12 whitespace-nowrap cursor-pointer list-none items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-on-dark shadow-lg shadow-ink/20 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4" aria-hidden focusable="false">
          <path d="M5 7h14M5 12h10M5 17h7" />
        </svg>
        {label} · <span className="tabular-nums">{counter}</span>
      </summary>
      <ol className="absolute bottom-full left-1/2 mb-2 max-h-[60vh] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-3xl border border-line bg-white p-2 shadow-xl shadow-ink/10">
        {items.map((item, i) => {
          const on = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={close}
                aria-current={on ? "location" : undefined}
                className={
                  "focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm leading-snug " +
                  (on ? "bg-brand-50 font-bold text-brand-700" : "text-ink")
                }
              >
                <span className={"w-4 shrink-0 text-right font-display font-bold tabular-nums " + (on ? "text-brand-500" : "text-muted")}>
                  {i + 1}
                </span>
                {item.title}
              </a>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

// Чек-лист («30 kunlik reja», «Shu hafta boshlang»): белые карточки с квадратными галочками.
// Отметки хранятся только в этом браузере (удобство, а не данные: если хранилище недоступно,
// список просто работает без запоминания).
export function Checklist({
  storageKey,
  items,
  lang,
}: {
  storageKey: string;
  items: { text: string; note?: ReactNode }[];
  lang: string;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown;
      if (Array.isArray(saved)) setChecked(items.map((_, i) => saved[i] === true));
    } catch {
      // Хранилище недоступно (приватный режим) — без запоминания.
    }
  }, [storageKey, items]);

  function toggle(i: number) {
    const next = checked.map((v, j) => (j === i ? !v : v));
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // см. выше
    }
  }

  return (
    <ol className="space-y-2.5" lang={lang}>
      {items.map((item, i) => (
        <li key={i}>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-teal has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/40">
            <span className="relative mt-0.5 flex size-6 shrink-0">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="peer size-6 cursor-pointer appearance-none rounded-md border-2 border-faint bg-white checked:border-teal checked:bg-teal focus:outline-none"
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute inset-1 hidden text-white peer-checked:block"
                aria-hidden
                focusable="false"
              >
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className={"block leading-relaxed " + (checked[i] ? "text-muted line-through decoration-muted/60" : "font-semibold")}>
                {item.text}
              </span>
              {item.note && <span className="mt-1 block text-sm leading-relaxed text-muted">{item.note}</span>}
            </span>
          </label>
        </li>
      ))}
    </ol>
  );
}

// Варианты маршрута (t.routeTypes): карточки-переключатели (на компьютере три в ряд), основной —
// первый, выбран по умолчанию. Под карточками — подробности выбранного варианта (children[i]):
// все шаги, требования, результат и «что проверить» остаются доступны для каждого варианта.
export function RouteSwitcher({
  cards,
  label,
  children,
}: {
  cards: { kicker: string; kickerClass: string; title: string; meta: string }[];
  label: string;
  children: ReactNode[];
}) {
  const [selected, setSelected] = useState(0);
  return (
    <>
      {cards.length > 1 && (
        <div role="group" aria-label={label} className={"grid gap-3 " + (cards.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {cards.map((c, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
              className={
                "focus-ring rounded-3xl border-2 bg-white p-4 text-left transition-colors " +
                (selected === i ? "border-brand-500" : "border-line hover:border-brand-100")
              }
            >
              <span className={"block text-xs font-bold uppercase tracking-wider " + c.kickerClass}>{c.kicker}</span>
              <span className="mt-1.5 block font-display font-bold leading-snug">{c.title}</span>
              <span className="mt-1 block text-sm text-muted">{c.meta}</span>
            </button>
          ))}
        </div>
      )}
      {children[selected]}
    </>
  );
}
