"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MockBadge } from "@/app/teaser/MockBadge";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";

// Экран генерации полного отчёта. Раз в 3 секунды спрашивает POST /api/report/<id>: сервер отвечает
// сразу и, если никто не генерирует, запускает в фоне следующую часть. Когда отчёт готов —
// перезагружает страницу. При сбое — сообщение и кнопка «Сгенерировать заново» (без оплаты).

type ReportDict = Dictionary["report"];
type Phase = "running" | "failed" | "network";

const POLL_MS = 3000;

export function ReportGenerator({
  reportId,
  t,
  mockBadge,
  initial,
}: {
  reportId: string;
  t: ReportDict;
  // Плашка «тестовый режим ИИ» (null — настоящий ИИ).
  mockBadge: { label: string; note: string } | null;
  initial: { status: "generating" | "failed"; done: number; total: number };
}) {
  const [phase, setPhase] = useState<Phase>(initial.status === "failed" ? "failed" : "running");
  const [done, setDone] = useState(initial.done);
  const total = initial.total;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  const poll = useCallback(
    async (regenerate = false) => {
      if (timer.current) clearTimeout(timer.current);
      try {
        const res = await fetch(`/api/report/${reportId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(regenerate ? { regenerate: true } : {}),
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 404) {
          window.location.reload();
          return;
        }
        const data = (await res.json()) as { status: string; done: number };
        setDone(data.done);
        if (data.status === "ready") {
          window.location.reload();
          return;
        }
        if (data.status === "failed") {
          setPhase("failed");
          return;
        }
        setPhase("running");
        timer.current = setTimeout(() => void poll(), POLL_MS);
      } catch {
        setPhase("network");
      }
    },
    [reportId],
  );

  useEffect(() => {
    // В режиме разработки React вызывает эффект дважды — опрос запускаем один раз.
    if (!started.current && initial.status !== "failed") {
      started.current = true;
      void poll();
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll, initial.status]);

  const percent = Math.round((Math.max(done, 0.35) / total) * 100);

  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-6">
      {mockBadge && <MockBadge label={mockBadge.label} note={mockBadge.note} />}
      {phase === "running" ? (
        <div className="pt-6 text-center" role="status" aria-live="polite">
          <div className="relative mx-auto size-36">
            <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20 [animation-duration:2.4s]" />
            <div className="absolute inset-3 animate-spin rounded-full bg-[conic-gradient(from_0deg,#2f6fed,#7c3aed,#db2777,#2f6fed)] [animation-duration:3s]" />
            <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-5xl shadow-inner">
              <span className="animate-pulse" aria-hidden>
                🧭
              </span>
            </div>
          </div>
          <p className="mt-6 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
            ✓ {t.generating.paid}
          </p>
          <h1 className="mt-4 text-2xl font-extrabold">{t.generating.title}</h1>

          <div className="mx-auto mt-6 max-w-xs">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-[width] duration-1000"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">{fmt(t.generating.partOf, { n: done, total })}</p>
          </div>

          <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left">
            {t.generating.steps.map((label, i) => (
              <li key={label} className={"flex items-center gap-3 " + (i <= done ? "opacity-100" : "opacity-40")}>
                <span
                  className={
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                    (i < done ? "bg-emerald-500 text-white" : i === done ? "bg-brand-500 text-white" : "bg-slate-200")
                  }
                  aria-hidden
                >
                  {i < done ? "✓" : i === done ? <span className="size-2 animate-pulse rounded-full bg-white" /> : ""}
                </span>
                <span className={i === done ? "font-semibold" : "text-muted"}>{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-muted">{t.generating.wait}</p>
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-slate-200 p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-2xl" aria-hidden>
            ⚠️
          </div>
          <h1 className="mt-4 text-xl font-extrabold">{phase === "failed" ? t.failedTitle : t.networkError}</h1>
          {phase === "failed" && <p className="mt-2 text-muted">{t.failedText}</p>}
          <button
            type="button"
            onClick={() => {
              setPhase("running");
              void poll(phase === "failed");
            }}
            className="mt-6 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white hover:bg-brand-600"
          >
            {phase === "failed" ? t.regenerate : t.retry}
          </button>
        </div>
      )}
    </div>
  );
}
