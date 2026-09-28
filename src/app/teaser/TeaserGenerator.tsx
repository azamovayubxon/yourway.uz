"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "@/components/flow";
import { CompassMark } from "@/components/Logo";
import { MockBadge } from "./MockBadge";

// Экран генерации: «Анализируем ваш профиль…» с анимацией. Запускает генерацию тизера
// (POST /api/teaser отвечает сразу, генерация идёт в фоне), затем раз в 3 секунды спрашивает статус
// (GET /api/teaser) и, когда тизер готов, перезагружает страницу. Ни один запрос не висит долго.

interface GeneratorDict {
  mockBadge: string;
  mockNote: string;
  generating: { title: string; steps: string[]; wait: string; longWait: string };
  failedTitle: string;
  failedText: string;
  networkError: string;
  retry: string;
  limitTitle: string;
  limitSession: string;
  limitIp: string;
}

type Phase = "running" | "failed" | "network" | "limit_session" | "limit_ip";

// Пока генерация идёт в фоне, спрашиваем статус раз в 3 секунды.
const POLL_MS = 3000;
// После этого времени статус честно меняется на «это занимает дольше обычного» (ТЗ аудита §13):
// список шагов ниже — не наблюдение за реальным прогрессом (для тизера сервер не сообщает
// промежуточные шаги, это один вызов ИИ), поэтому мы не анимируем «выполнение» по таймеру —
// только показываем, что вообще происходит, и честно отмечаем долгое ожидание.
const LONG_WAIT_MS = 25_000;

export function TeaserGenerator({ t, mock, restartLabel }: { t: GeneratorDict; mock: boolean; restartLabel: string }) {
  const [phase, setPhase] = useState<Phase>("running");
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // poll() иногда должен запустить run(), а run() — poll(); ссылка разрывает этот круг.
  const runRef = useRef<(() => Promise<void>) | null>(null);

  // Опрос статуса (GET): ничего не запускает, только ждёт готовности.
  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/teaser", { cache: "no-store" });
      const data = (await res.json()) as { status: string };
      switch (data.status) {
        case "ready":
          // Полная перезагрузка: сервер отрисует готовый тизер (и уберёт ?generate=1 из адреса).
          window.location.replace("/teaser");
          return;
        case "generating":
          timer.current = setTimeout(() => void poll(), POLL_MS);
          return;
        case "none":
          // Генерация не запущена или зависла — запускаем её (вызов ниже объявлен через ref).
          void runRef.current?.();
          return;
        default:
          setPhase("failed");
      }
    } catch {
      setPhase("network");
    }
  }, []);

  // Запуск генерации (POST): сервер отвечает сразу, сама генерация идёт в фоне.
  const run = useCallback(async () => {
    setPhase("running");
    try {
      const res = await fetch("/api/teaser", { method: "POST" });
      const data = (await res.json()) as { status: string; reason?: string };
      switch (data.status) {
        case "ready":
          window.location.replace("/teaser");
          return;
        case "generating":
          timer.current = setTimeout(() => void poll(), POLL_MS);
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
  }, [poll]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

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

  const limit = phase.startsWith("limit");
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12 pt-6 lg:pt-10">
      {mock && <MockBadge label={t.mockBadge} note={t.mockNote} />}
      {phase === "running" ? (
        <Analyzing t={t.generating} />
      ) : (
        <div className="mt-10 rounded-[28px] border border-line bg-white px-6 py-10 text-center sm:px-10">
          <div className={"mx-auto flex size-20 items-center justify-center rounded-full " + (limit ? "bg-sand text-ink" : "bg-sun-50 text-brand-600")} aria-hidden>
            {limit ? <HourglassIcon /> : <AlertIcon />}
          </div>
          <h1 className="mt-6 text-2xl font-extrabold leading-tight lg:text-[36px]">{limit ? t.limitTitle : t.failedTitle}</h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted lg:text-lg">
            {phase === "limit_ip"
              ? t.limitIp
              : phase === "limit_session"
                ? t.limitSession
                : phase === "network"
                  ? t.networkError
                  : t.failedText}
          </p>
          {phase === "failed" || phase === "network" ? (
            <button type="button" onClick={() => void run()} className={primaryButtonClass + " mt-8"}>
              {t.retry}
            </button>
          ) : phase === "limit_session" ? (
            <Link href="/start?new=1" className={primaryButtonClass + " mt-8"}>
              {restartLabel}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Смена фразы-пояснения, мс.
const STEP_MS = 3500;

// Экран ожидания. В центре — знак-компас в песочном круге: кольцо медленно вращается, роза
// «ищет направление». Под заголовком по очереди сменяются фразы из t.steps — ТОЛЬКО как пояснение
// того, что вообще происходит при составлении портрета, без галочек и «шаг 2 из 5»: сервер для
// тизера не сообщает промежуточные этапы (это один вызов ИИ), изображать прогресс, которого нет,
// нельзя (ТЗ аудита §13, UX-20). Честный сигнал — секундомер и смена текста на longWait.
function Analyzing({ t }: { t: GeneratorDict["generating"] }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const longWait = seconds * 1000 >= LONG_WAIT_MS;
  const step = t.steps[Math.floor((seconds * 1000) / STEP_MS) % t.steps.length];
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="pt-8 text-center lg:pt-12">
      <div className="mx-auto flex size-44 items-center justify-center rounded-full bg-sand lg:size-52" aria-hidden>
        <CompassMark size={128} animated className="lg:size-36" />
      </div>
      {/* Живая область — только заголовок и строка ожидания (меняется один раз, на longWait).
          Сменяющиеся фразы и секундомер читалкам не объявляются: иначе они говорили бы каждые
          несколько секунд. */}
      <div role="status" aria-live="polite">
        <h1 className="mt-8 text-[28px] font-extrabold leading-tight lg:text-[40px]">{t.title}</h1>
        <p key={step} aria-hidden className="yw-rise mx-auto mt-3 min-h-[3.25rem] max-w-sm text-lg leading-snug text-muted">
          {step}
        </p>
        <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-muted">{longWait ? t.longWait : t.wait}</p>
      </div>
      <p aria-hidden className="mx-auto mt-4 w-fit rounded-full border border-line bg-white px-3.5 py-1 text-sm tabular-nums text-muted">
        {clock}
      </p>
    </div>
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

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-9" focusable="false">
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5" />
    </svg>
  );
}
