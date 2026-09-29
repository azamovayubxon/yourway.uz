"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MockBadge } from "@/app/teaser/MockBadge";
import { CheckIcon } from "@/components/flow";
import { CompassMark } from "@/components/Logo";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";

// Экран генерации полного отчёта. Раз в 3 секунды спрашивает POST /api/report/<id>: сервер отвечает
// сразу и, если никто не генерирует, запускает в фоне следующую часть. Когда отчёт готов —
// перезагружает страницу. При сбое — сообщение и кнопка «Сгенерировать заново» (без оплаты).

type ReportDict = Dictionary["report"];
type Phase = "running" | "failed" | "network";

const POLL_MS = 3000;
// После этого времени статус честно меняется на «это дольше обычного» (ожидаемый диапазон —
// 3–8 минут, см. t.generating.wait), а не молчит до самого результата (ТЗ аудита §13).
const LONG_WAIT_MS = 8 * 60_000;

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
  const [longWait, setLongWait] = useState(false);
  const total = initial.total;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => clearTimeout(id);
  }, [phase]);

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

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-14 pt-6 lg:pt-10">
      {mockBadge && <MockBadge label={mockBadge.label} note={mockBadge.note} />}
      {phase === "running" ? (
        <div className="text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal">
            <CheckIcon className="size-4" />
            {t.generating.paid}
          </p>
          <div className="mx-auto mt-8 flex size-40 items-center justify-center rounded-full bg-sand lg:size-48" aria-hidden>
            <CompassMark size={112} animated className="lg:size-32" />
          </div>
          {/* Живая область — заголовок и «готово N из 3»: меняется только когда часть действительно
              дописана (данные с сервера), а не по таймеру. */}
          <div role="status" aria-live="polite">
            <h1 className="mt-8 text-[28px] font-extrabold leading-tight lg:text-[40px]">{t.generating.title}</h1>
            <p className="sr-only">{fmt(t.generating.partOf, { n: done, total })}</p>
          </div>
          <PartsList steps={t.generating.steps} done={done} t={t.generating} />
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted" aria-hidden>
            {fmt(t.generating.partOf, { n: done, total })}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{longWait ? t.generating.longWait : t.generating.wait}</p>
        </div>
      ) : (
        <div className="mt-6 rounded-[28px] border border-line bg-white px-6 py-10 text-center sm:px-10">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-sun-50 text-brand-600" aria-hidden>
            <AlertIcon />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold leading-tight lg:text-[32px]">
            {phase === "failed" ? t.failedTitle : t.networkError}
          </h1>
          {phase === "failed" && <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{t.failedText}</p>}
          {done > 0 && <p className="mt-3 text-sm text-muted">{fmt(t.generating.partOf, { n: done, total })}</p>}
          <button
            type="button"
            onClick={() => {
              setPhase("running");
              void poll(phase === "failed");
            }}
            className="focus-ring mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-500 px-7 font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 sm:w-auto"
          >
            {phase === "failed" ? t.regenerate : t.retry}
          </button>
        </div>
      )}
    </div>
  );
}

// Три части отчёта с их НАСТОЯЩИМ состоянием. Это не «фальшивый прогресс» (UX-20): части пишутся
// строго по очереди (REPORT_PARTS), сервер знает, сколько уже готово (done из POST /api/report/<id>),
// значит первая неготовая часть — та, что пишется сейчас. Готова — бирюзовая галочка; пишется —
// терракотовая рамка и крутящийся индикатор; ещё не начата — серая.
function PartsList({ steps, done, t }: { steps: string[]; done: number; t: ReportDict["generating"] }) {
  return (
    <ol className="mx-auto mt-8 max-w-md space-y-2.5 text-left">
      {steps.map((label, i) => {
        const state = i < done ? "done" : i === done ? "current" : "upcoming";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={
              "flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 " +
              (state === "current" ? "border-brand-500" : "border-line")
            }
          >
            {state === "done" ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal text-white" aria-hidden>
                <CheckIcon className="size-4" />
              </span>
            ) : state === "current" ? (
              <span className="size-7 shrink-0 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-500" aria-hidden />
            ) : (
              <span className="size-7 shrink-0 rounded-full border-2 border-line" aria-hidden />
            )}
            <span className={"min-w-0 flex-1 leading-snug " + (state === "upcoming" ? "text-muted" : "font-semibold")}>{label}</span>
            {state === "current" && <span className="shrink-0 text-xs text-muted">{t.stepWriting}</span>}
            {state === "done" && <span className="sr-only">{t.stepDone}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-9" focusable="false">
      <path d="M12 7.5v6" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
