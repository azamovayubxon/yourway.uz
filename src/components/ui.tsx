import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Основная кнопка сайта: терракота, полностью круглая (pill), без тени — стиль «тёплый плоский».
export function CtaButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={
        "focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-brand-500 px-7 text-base font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 " +
        className
      }
    >
      {children}
    </Link>
  );
}

// Карточка-вариант ответа в анкете: крупная белая «таблетка», выбранная — терракотовая рамка и
// мягкий терракотовый фон. Состояния default / hover / selected(aria-pressed) / focus / disabled —
// в одном месте, чтобы визуально не расходились между экранами (ТЗ аудита §4).
// (Ответы тестов — шкала-круги LikertScale из components/flow.tsx.)
export function OptionButton({
  active,
  leading,
  children,
  className = "",
  ...rest
}: {
  active?: boolean;
  leading?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={
        "focus-ring flex min-h-14 w-full items-center gap-3 rounded-3xl border-2 px-5 py-3 text-left font-semibold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
        (active ? "border-brand-500 bg-brand-50 text-ink" : "border-line bg-white text-ink hover:border-brand-500") +
        " " +
        className
      }
      {...rest}
    >
      {leading}
      <span className="flex-1">{children}</span>
    </button>
  );
}

// Галочка слева от варианта в множественном выборе.
export function CheckBadge({ active }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "flex size-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold " +
        (active ? "border-brand-500 bg-brand-500 text-white" : "border-faint bg-white")
      }
    >
      {active ? "✓" : ""}
    </span>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
      <h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="hyphens-auto break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed">{children}</div>
    </div>
  );
}

export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </p>
  );
}

// Дисклеймер «это не диагноз и не медицинская услуга» (этап 10Е) — на оферте, тизере и странице отчёта.
export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{children}</p>
  );
}
