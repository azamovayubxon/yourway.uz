"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MockBadge } from "./MockBadge";

// Экран генерации: «Анализируем ваш профиль…» с анимацией. Запускает генерацию тизера
// (POST /api/teaser), пока она идёт — показывает шаги, потом перезагружает страницу с готовым тизером.

interface GeneratorDict {
  mockBadge: string;
  mockNote: string;
  generating: { title: string; steps: string[]; wait: string };
  failedTitle: string;
  failedText: string;
  networkError: string;
  retry: string;
  limitTitle: string;
  limitSession: string;
  limitIp: string;
}

type Phase = "running" | "failed" | "network" | "limit_session" | "limit_ip";

// Пока генерация идёт в другой вкладке/запросе, спрашиваем статус раз в 3 секунды.
const POLL_MS = 3000;
// Шаги анимации сменяются каждые 2,5 секунды.
const STEP_MS = 2500;

export function TeaserGenerator({ t, mock, restartLabel }: { t: GeneratorDict; mock: boolean; restartLabel: string }) {
  const [phase, setPhase] = useState<Phase>("running");
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    setPhase("running");
    try {
      const res = await fetch("/api/teaser", { method: "POST" });
      const data = (await res.json()) as { status: string; reason?: string };
      switch (data.status) {
        case "ready":
          // Полная перезагрузка: сервер отрисует готовый тизер (и уберёт ?generate=1 из адреса).
          window.location.replace("/teaser");
          return;
        case "generating":
          timer.current = setTimeout(() => void run(), POLL_MS);
          return;
        case "limit":
          setPhase(data.reason === "ip" ? "limit_ip" : "limit_session");
          return;
        case "not_ready":
          window.location.replace("/start");
          return;
        default:
          setPhase("failed");
      }
    } catch {
      setPhase("network");
    }
  }, []);

  useEffect(() => {
    // В режиме разработки React вызывает эффект дважды — генерацию запускаем один раз.
    if (!started.current) {
      started.current = true;
      void run();
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-6">
      {mock && <MockBadge label={t.mockBadge} note={t.mockNote} />}
      {phase === "running" ? (
        <Analyzing t={t.generating} />
      ) : (
        <div className="mt-10 rounded-3xl border border-slate-200 p-6 text-center">
          <div
            className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-2xl"
            aria-hidden
          >
            {phase.startsWith("limit") ? "⏳" : "⚠️"}
          </div>
          <h1 className="mt-4 text-xl font-extrabold">{phase.startsWith("limit") ? t.limitTitle : t.failedTitle}</h1>
          <p className="mt-2 text-muted">
            {phase === "limit_ip"
              ? t.limitIp
              : phase === "limit_session"
                ? t.limitSession
                : phase === "network"
                  ? t.networkError
                  : t.failedText}
          </p>
          {phase === "failed" || phase === "network" ? (
            <button
              type="button"
              onClick={() => void run()}
              className="mt-6 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white hover:bg-brand-600"
            >
              {t.retry}
            </button>
          ) : phase === "limit_session" ? (
            <Link
              href="/start?new=1"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-500 px-6 font-bold text-white hover:bg-brand-600"
            >
              {restartLabel}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Analyzing({ t }: { t: GeneratorDict["generating"] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, t.steps.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [t.steps.length]);

  return (
    <div className="pt-8 text-center" role="status" aria-live="polite">
      <div className="relative mx-auto size-40">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20 [animation-duration:2.4s]" />
        <div className="absolute inset-3 animate-spin rounded-full bg-[conic-gradient(from_0deg,#2f6fed,#7c3aed,#db2777,#2f6fed)] [animation-duration:3s]" />
        <div className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-5xl shadow-inner">
          <span className="animate-pulse" aria-hidden>
            ✨
          </span>
        </div>
      </div>
      <h1 className="mt-8 text-2xl font-extrabold">{t.title}</h1>
      <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left">
        {t.steps.map((label, i) => (
          <li
            key={label}
            className={
              "flex items-center gap-3 transition-opacity duration-500 " + (i <= step ? "opacity-100" : "opacity-30")
            }
          >
            <span
              className={
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                (i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-500 text-white" : "bg-slate-200")
              }
              aria-hidden
            >
              {i < step ? "✓" : i === step ? <span className="size-2 animate-pulse rounded-full bg-white" /> : ""}
            </span>
            <span className={i === step ? "font-semibold" : "text-muted"}>{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted">{t.wait}</p>
    </div>
  );
}
