"use client";

import { useEffect, useState } from "react";

// Небольшие интерактивные части страницы отчёта.

type NavItem = { id: string; title: string };

// Какой раздел сейчас на экране — общая логика для горизонтальной ленты, бокового оглавления
// на компьютере и кнопки «Разделы»/«Boʻlimlar» на телефоне (ТЗ аудита §9).
function useActiveSection(items: NavItem[]): string | undefined {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);
  return active;
}

// Липкое горизонтальное оглавление: дополнительная навигация (ТЗ аудита §9), видна на всех
// шинах экрана поверх бокового меню на компьютере и кнопки «Разделы» на телефоне.
export function SectionNav({ items, label }: { items: NavItem[]; label: string }) {
  const active = useActiveSection(items);

  // Активный пункт прокручиваем в видимую часть ленты оглавления.
  useEffect(() => {
    document.getElementById(`nav-${active}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label={label}
      className="sticky top-14 z-[5] -mx-4 mt-6 border-b border-slate-100 bg-white/90 px-4 backdrop-blur print:hidden lg:hidden"
    >
      <ol className="flex gap-2 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <li key={item.id} className="shrink-0">
            <a
              id={`nav-${item.id}`}
              href={`#${item.id}`}
              className={
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors " +
                (active === item.id ? "bg-ink text-white" : "bg-slate-100 text-ink/70 hover:bg-slate-200")
              }
            >
              <span className="tabular-nums opacity-60">{i + 1}</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Боковое оглавление на компьютере (ТЗ аудита §9: «desktop: содержание сбоку»). Рядом с текстом,
// а не поверх него — липкое внутри своей колонки.
export function SectionSidebar({ items, label }: { items: NavItem[]; label: string }) {
  const active = useActiveSection(items);
  return (
    <nav aria-label={label} className="sticky top-20 hidden print:hidden lg:block">
      <ol className="space-y-1 border-l border-slate-100 pl-4">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={
                "flex items-baseline gap-2 rounded py-1.5 text-sm leading-snug transition-colors " +
                (active === item.id ? "font-bold text-brand-600" : "text-muted hover:text-ink")
              }
            >
              <span className="tabular-nums opacity-60">{i + 1}</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Кнопка «Разделы»/«Boʻlimlar» на телефоне (ТЗ аудита §9): открывает список разделов вместо
// бокового оглавления, которого на маленьком экране нет места.
export function MobileSectionsMenu({ items, label }: { items: NavItem[]; label: string }) {
  const active = useActiveSection(items);
  return (
    <details className="mt-4 rounded-2xl border border-slate-200 print:hidden lg:hidden">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span>
          ☰ {label}
        </span>
        <span className="text-muted">▾</span>
      </summary>
      <ol className="divide-y divide-slate-100 border-t border-slate-100">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={"flex min-h-11 items-center gap-2.5 px-4 text-sm " + (active === item.id ? "font-bold text-brand-600" : "")}
            >
              <span className="tabular-nums text-muted">{i + 1}</span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

// «Что сделать на этой неделе» — чек-лист. Отметки хранятся только в этом браузере (удобство,
// а не данные: если хранилище недоступно, список просто работает без запоминания).
export function ActNowChecklist({ storageKey, items, lang }: { storageKey: string; items: string[]; lang: string }) {
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
          <label
            className={
              "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors " +
              (checked[i] ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-slate-300")
            }
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 size-5 shrink-0 accent-emerald-600"
            />
            <span className={"leading-relaxed " + (checked[i] ? "text-muted line-through decoration-emerald-600/40" : "")}>
              {item}
            </span>
          </label>
        </li>
      ))}
    </ol>
  );
}
