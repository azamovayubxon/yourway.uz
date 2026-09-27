import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-600 active:bg-brand-700"
    >
      {children}
    </Link>
  );
}

// Карточка-вариант ответа: используется в тестах, опросе и на экране выбора сценария.
// Состояния default / hover / selected(aria-pressed) / focus / disabled — в одном месте,
// чтобы визуально не расходились между экранами (ТЗ аудита §4).
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
        "focus-ring flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
        (active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-line bg-white hover:border-brand-500 active:bg-brand-50") +
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

// Числовой бейдж 1–5 слева от варианта ответа шкалы (Big Five/RIASEC/ценности/восприятие).
export function ScaleBadge({ value, active }: { value: number; active?: boolean }) {
  return (
    <span
      className={
        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
        (active ? "bg-white text-brand-600" : "bg-slate-100 text-ink")
      }
    >
      {value}
    </span>
  );
}

// Галочка слева от варианта в множественном выборе.
export function CheckBadge({ active }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-xs " +
        (active ? "border-white bg-white text-brand-600" : "border-slate-300")
      }
    >
      {active ? "✓" : ""}
    </span>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-4 pt-14">
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
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
