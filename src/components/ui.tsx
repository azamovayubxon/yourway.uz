import Link from "next/link";
import type { ReactNode } from "react";

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-600 active:bg-brand-700"
    >
      {children}
    </Link>
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
