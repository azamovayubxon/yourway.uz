import Link from "next/link";
import type { ReactNode } from "react";

// Общие элементы админки (этап 8). Интерфейс — только на русском (владелец так решил): здесь
// тексты не берутся из словарей i18n, а пишутся прямо в JSX.

export const ADMIN_NAV = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/prices", label: "Цены" },
  { href: "/admin/promo", label: "Промокоды" },
  { href: "/admin/prompts", label: "Промпты и модели" },
  { href: "/admin/reports", label: "Отчёты" },
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/ai-log", label: "Себестоимость ИИ" },
  { href: "/admin/errors", label: "Ошибки" },
] as const;

export function AdminShell({
  title,
  isSuperAdmin,
  children,
}: {
  title: string;
  isSuperAdmin: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="shrink-0 lg:w-56">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-muted">Админка</p>
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {ADMIN_NAV.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-slate-100 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {isSuperAdmin && (
              <li className="shrink-0">
                <Link
                  href="/admin/admins"
                  className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-slate-100 hover:text-ink"
                >
                  Администраторы
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
          <div className="mt-4 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      {title && <h2 className="mb-3 font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Notice({ kind = "ok", children }: { kind?: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      className={
        "rounded-xl px-4 py-3 text-sm " +
        (kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800")
      }
    >
      {children}
    </p>
  );
}

// Простая таблица, которая на узком экране не сжимается в кашу: строки переносятся,
// а не режутся — используем её вместо <table> там, где колонок много.
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-muted">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 align-top">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
