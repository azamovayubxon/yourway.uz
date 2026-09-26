"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TestId } from "@/lib/assessment/tests";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";

// Прохождение 4 тестов: один вопрос на экран, кнопки 1–5, автопереход, «Назад», прогресс.
//
// Автосохранение: каждый ответ сразу кладётся в «очередь на отправку» в памяти браузера
// (localStorage) и отправляется на сервер. Если связи нет, очередь остаётся на устройстве
// и отправляется, когда связь появится. Поэтому ответы не теряются при обрыве.

export interface RunnerTest {
  id: TestId;
  questions: { id: number; text: string }[];
  scaleLabels: { value: number; label: string }[];
}

interface Props {
  sessionId: string;
  tests: RunnerTest[];
  initialAnswers: Record<string, number>; // ключ "big_five:12" → ответ
  t: Dictionary["test"] & { doneTitle: string; doneText: string; continueToSurvey: string };
}

type SyncState = "idle" | "offline" | "lost";

const ADVANCE_DELAY_MS = 180; // короткая пауза, чтобы было видно, какая кнопка нажата
const RETRY_MS = 4000;

const pendingKey = (sessionId: string) => `yw_pending:${sessionId}`;

function readPending(sessionId: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(sessionId)) ?? "{}");
  } catch {
    return {};
  }
}

function writePending(sessionId: string, pending: Record<string, number>) {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(pendingKey(sessionId));
    else localStorage.setItem(pendingKey(sessionId), JSON.stringify(pending));
  } catch {
    // Хранилище недоступно (приватный режим): ответы всё равно отправляются на сервер.
  }
}

export function TestRunner({ sessionId, tests, initialAnswers, t }: Props) {
  // Все вопросы подряд в порядке воронки.
  const items = useMemo(
    () =>
      tests.flatMap((test, testIndex) =>
        test.questions.map((q, i) => ({
          key: `${test.id}:${q.id}`,
          test,
          testIndex,
          number: i + 1,
          text: q.text,
        })),
      ),
    [tests],
  );
  const total = items.length;

  const firstUnanswered = (answers: Record<string, number>) => {
    const i = items.findIndex((item) => answers[item.key] === undefined);
    return i === -1 ? total : i;
  };

  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(() => firstUnanswered(initialAnswers));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [locked, setLocked] = useState(false);

  const pending = useRef<Record<string, number>>({});
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Текущее состояние синхронизации нужно внутри flush без пересоздания функции.
  const syncStateRef = useRef<SyncState>("idle");
  const setSync = (s: SyncState) => {
    syncStateRef.current = s;
    setSyncState(s);
  };

  const flush = useCallback(async () => {
    if (inFlight.current || syncStateRef.current === "lost") return;
    const snapshot = { ...pending.current };
    const keys = Object.keys(snapshot);
    if (keys.length === 0) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/session/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: keys.map((key) => {
            const [test, id] = key.split(":");
            return { test, questionId: Number(id), value: snapshot[key] };
          }),
        }),
      });
      if (res.status === 409) {
        setSync("lost");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Убираем из очереди только то, что не изменилось, пока шёл запрос.
      for (const key of keys) {
        if (pending.current[key] === snapshot[key]) delete pending.current[key];
      }
      writePending(sessionId, pending.current);
      setPendingCount(Object.keys(pending.current).length);
      setSync("idle");
    } catch {
      setSync("offline");
    } finally {
      inFlight.current = false;
    }
    if (Object.keys(pending.current).length > 0) {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void flush(), syncStateRef.current === "offline" ? RETRY_MS : 0);
    }
  }, [sessionId]);

  // После загрузки: добавляем ответы, которые остались неотправленными с прошлого раза.
  useEffect(() => {
    const saved = readPending(sessionId);
    if (Object.keys(saved).length > 0) {
      pending.current = { ...saved, ...pending.current };
      setPendingCount(Object.keys(pending.current).length);
      const merged = { ...initialAnswers, ...saved };
      setAnswers(merged);
      setIndex(firstUnanswered(merged));
      void flush();
    }
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // Только при открытии страницы: остальные значения здесь нужны в их начальном виде.
  }, [sessionId, flush]);

  function answer(value: number) {
    if (locked || index >= total) return;
    const key = items[index].key;
    setAnswers((prev) => ({ ...prev, [key]: value }));
    pending.current[key] = value;
    writePending(sessionId, pending.current);
    setPendingCount(Object.keys(pending.current).length);
    void flush();

    setLocked(true);
    setTimeout(() => {
      setIndex((i) => Math.min(i + 1, total));
      setLocked(false);
      window.scrollTo({ top: 0 });
    }, ADVANCE_DELAY_MS);
  }

  function back() {
    if (index > 0 && !locked) setIndex(index - 1);
  }

  const answeredCount = items.filter((item) => answers[item.key] !== undefined).length;
  const progress = Math.round((Math.min(index, total) / total) * 100);

  const status =
    syncState === "lost" ? (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        {t.sessionLost}{" "}
        <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">
          {t.reload}
        </button>
      </p>
    ) : syncState === "offline" && pendingCount > 0 ? (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.offline}</p>
    ) : null;

  // Все вопросы отвечены.
  if (index >= total) {
    const saved = pendingCount === 0 && answeredCount === total;
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <ProgressBar value={100} />
        <h1 className="mt-8 text-2xl font-extrabold sm:text-3xl">{t.doneTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{t.doneText}</p>
        <div className="mt-6 space-y-4">
          {!saved && syncState !== "lost" && <p className="text-sm text-muted">{t.saving}</p>}
          {status}
          {saved && (
            <Link
              href="/survey"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-600 active:bg-brand-700"
            >
              {t.continueToSurvey}
            </Link>
          )}
          <BackButton label={t.back} onClick={back} disabled={locked} />
        </div>
      </div>
    );
  }

  const item = items[index];
  const selected = answers[item.key];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-brand-600">
          {fmt(t.partOf, { n: item.testIndex + 1, total: tests.length })} · {t.parts[item.test.id]}
        </p>
        <p className="shrink-0 text-muted">{fmt(t.questionOf, { n: index + 1, total })}</p>
      </div>
      <ProgressBar value={progress} />

      <p className="mt-8 text-sm text-muted">{t.prompts[item.test.id]}</p>
      {/* Высота с запасом, чтобы кнопки не прыгали между короткими и длинными вопросами. */}
      <h1 className="mt-2 min-h-[5.5rem] text-xl font-bold leading-snug sm:text-2xl" aria-live="polite">
        {item.text}
      </h1>

      <div className="mt-4 grid gap-2.5" role="group" aria-label={t.prompts[item.test.id]}>
        {item.test.scaleLabels.map((s) => {
          const active = selected === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => answer(s.value)}
              aria-pressed={active}
              className={
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left transition-colors " +
                (active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white hover:border-brand-500 active:bg-brand-50")
              }
            >
              <span
                className={
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                  (active ? "bg-white text-brand-600" : "bg-slate-100 text-ink")
                }
              >
                {s.value}
              </span>
              <span className="font-medium leading-tight">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        <BackButton label={t.back} onClick={back} disabled={index === 0 || locked} />
        {status}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}

function BackButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 py-2 font-semibold text-brand-600 disabled:text-slate-300"
    >
      ← {label}
    </button>
  );
}
