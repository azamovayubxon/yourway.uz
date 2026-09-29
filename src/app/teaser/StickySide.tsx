"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Левая колонка страницы результата на компьютере (этап 2б): карточка типа, кнопки и блок оплаты
// «прилипают» при прокрутке (position: sticky). Если колонка выше окна, обычный sticky спрятал бы
// её низ (кнопку оплаты) до самого конца страницы. Поэтому считаем top так, чтобы колонка сначала
// прокручивалась вместе со страницей, а прилипала, когда её низ дошёл до низа окна.
// На телефоне обёртка — display: contents (классы задаёт TeaserView), top ни на что не влияет.
const TOP = 88; // под липкой шапкой сайта

export function StickySide({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(TOP, window.innerHeight - el.offsetHeight - 16));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={top === null ? undefined : { top }}>
      {children}
    </div>
  );
}
