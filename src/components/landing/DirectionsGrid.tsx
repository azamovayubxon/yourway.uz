"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { SOON_DIRECTIONS, type SoonDirection } from "@/lib/directions";
import { LandingIcon } from "./icons";

// Сетка «Направления» на главной. Компьютер: 4 колонки, большая карточка «Путь профессии» — 2×2.
// Телефон: большая на всю ширину, остальные по 2 в ряд.
// Нажатие на карточку «Скоро» открывает окно (нативный <dialog>: фокус внутри, Esc закрывает) и
// отправляет событие интереса soon:<id> в /api/soon. После закрытия фокус возвращается на карточку.

type DirectionsText = Dictionary["landing"]["directions"];

// Цвет плашки иконки: чередуем терракоту и бирюзу, «Для моего ребёнка» — тёплым жёлтым.
const TONE: Record<SoonDirection, "brand" | "teal" | "sun"> = {
  university: "brand",
  parents: "sun",
  abroad: "teal",
  language: "brand",
  exam: "teal",
  online: "brand",
  business: "teal",
  sport: "brand",
  hobby: "teal",
  money: "brand",
  people: "teal",
};

const ICON_TONE = {
  brand: "bg-brand-50 text-brand-600",
  teal: "bg-teal-50 text-teal",
  sun: "bg-white text-brand-600",
} as const;

export function DirectionsGrid({
  d,
  mainLines,
  telegramUrl,
}: {
  d: DirectionsText;
  // Пункты большой карточки с уже подставленными ценами из базы.
  mainLines: [string, string, string];
  telegramUrl: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [active, setActive] = useState<SoonDirection | null>(null);

  function openSoon(id: SoonDirection, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setActive(id);
    dialogRef.current?.showModal();
    // Счётчик интереса. Ошибка сети не должна мешать человеку — окно всё равно открывается.
    fetch("/api/soon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Большая карточка: единственное работающее направление */}
        <li className="col-span-2 flex flex-col rounded-[28px] bg-teal p-6 text-white sm:p-8 lg:row-span-2">
          <span className="self-start rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">{d.main.badge}</span>
          <h3 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{d.main.title}</h3>
          <p className="mt-2 text-lg leading-snug text-white">{d.main.question}</p>
          <ul className="mt-5 space-y-2 text-sm sm:text-base">
            {mainLines.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sun text-ink">
                  <LandingIcon name="check" className="size-3.5" />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-end justify-between gap-4 pt-7">
            <Link
              href="/start"
              className="focus-ring-light inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-bold text-teal transition-colors hover:bg-teal-50"
            >
              {d.main.cta}
            </Link>
            {/* Декор: вершина-«цель» в пунктирном круге */}
            <span aria-hidden className="relative hidden size-24 shrink-0 sm:block">
              <span className="absolute inset-0 rounded-full border-2 border-dashed border-white/35" />
              <span className="absolute inset-3 flex items-center justify-center rounded-full bg-ink/25">
                <svg viewBox="0 0 48 48" className="size-10" fill="none" stroke="#F5B83D" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
                  <path d="M6 36 18 16l8 12 6-8 10 16" />
                </svg>
              </span>
            </span>
          </div>
        </li>

        {SOON_DIRECTIONS.map((id) => {
          const item = d.soon[id];
          const tone = TONE[id];
          return (
            <li key={id} className="flex">
              <button
                type="button"
                data-soon={id}
                aria-haspopup="dialog"
                onClick={(e) => openSoon(id, e.currentTarget)}
                className={
                  "focus-ring flex w-full flex-col rounded-3xl border p-4 text-left transition-colors sm:p-5 " +
                  (tone === "sun"
                    ? "border-sun/60 bg-sun-50 hover:border-brand-500"
                    : "border-line bg-white hover:border-brand-500")
                }
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className={"flex size-10 items-center justify-center rounded-2xl " + ICON_TONE[tone]}>
                    <LandingIcon name={id} />
                  </span>
                  <span className="rounded-full bg-app-bg px-2 py-0.5 text-[11px] font-semibold leading-5 text-muted">
                    {d.soonBadge}
                  </span>
                </span>
                <span className="mt-3 font-display text-[15px] font-bold leading-snug text-ink sm:text-base">
                  {item.title}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{item.text}</span>
              </button>
            </li>
          );
        })}

        {/* Последняя ячейка: какое направление нужно ещё */}
        <li className="flex flex-col rounded-3xl border-2 border-dashed border-faint/50 p-4 sm:p-5">
          <h3 className="font-bold leading-snug">{d.ask.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{d.ask.text}</p>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-auto self-start rounded pt-3 text-sm font-bold text-brand-600 hover:text-brand-700"
          >
            {d.ask.link}{"\u00a0"}→
          </a>
        </li>
      </ul>

      <dialog
        ref={dialogRef}
        aria-labelledby="soon-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        onClick={(e) => {
          // Нажатие на затемнённый фон вокруг окна закрывает его.
          if (e.target === e.currentTarget) closeDialog();
        }}
        className="yw-dialog m-auto w-[calc(100%-2rem)] max-w-sm rounded-[28px] bg-white p-0 text-ink"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 id="soon-dialog-title" className="text-xl font-extrabold leading-snug">
              {active ? d.soon[active].title : ""}
            </h3>
            <button
              type="button"
              onClick={closeDialog}
              aria-label={d.dialog.close}
              className="focus-ring -mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-app-bg hover:text-ink"
            >
              <LandingIcon name="close" />
            </button>
          </div>
          <p className="mt-2 leading-relaxed text-muted">{d.dialog.text}</p>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600"
          >
            <LandingIcon name="send" />
            {d.dialog.subscribe}
          </a>
        </div>
      </dialog>
    </>
  );
}
