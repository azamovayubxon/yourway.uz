"use client";

import { useEffect, useState } from "react";

// Небольшие интерактивные части страницы отчёта.

// Липкое оглавление: подсвечивает раздел, который сейчас на экране.
export function SectionNav({ items, label }: { items: { id: string; title: string }[]; label: string }) {
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

  // Активный пункт прокручиваем в видимую часть ленты оглавления.
  useEffect(() => {
    document.getElementById(`nav-${active}`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label={label}
      className="sticky top-14 z-[5] -mx-4 mt-6 border-b border-slate-100 bg-white/90 px-4 backdrop-blur print:hidden"
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
