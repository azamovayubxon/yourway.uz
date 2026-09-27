"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TestId } from "@/lib/assessment/tests";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { OptionButton, ScaleBadge } from "@/components/ui";
import { PausePanel, SaveStatus, StageBreadcrumb, type SaveState } from "@/components/flow";

// Прохождение 4 тестов: экран подготовки → один вопрос на экран (кнопки 1–5, автопереход,
// «Назад», прогресс) → промежуточный экран между блоками → готово.
//
// Автосохранение: каждый ответ сразу кладётся в «очередь на отправку» в памяти браузера
// (localStorage) и отправляется на сервер. Если связи нет, очередь остаётся на устройстве
// и отправляется, когда связь появится. Поэтому ответы не теряются при обрыве.

export interface RunnerTest {
  id: TestId;
  questions: { id: number; text: string }[];
  scaleLabels: { value: number; label: string }[];
}

type TestDict = Dictionary["test"] & { doneTitle: string; doneText: string; continueToSurvey: string };

interface Props {
  sessionId: string;
  tests: RunnerTest[];
  initialAnswers: Record<string, number>; // ключ "big_five:12" → ответ
  t: TestDict;
  stages: Dictionary["flow"]["stages"];
}

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

export function TestRunner({ sessionId, tests, initialAnswers, t, stages }: Props) {
  // Все вопросы подряд в порядке воронки.
  const items = useMemo(
    () =>
      tests.flatMap((test, testIndex) =>
        test.questions.map((q, i) => ({
          key: `${test.id}:${q.id}`,
          test,
          testIndex,
          number: i + 1, // номер вопроса внутри своего блока (для компактного «12/60»)
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
  const [syncState, setSyncState] = useState<"idle" | "offline" | "lost">("idle");
  const [locked, setLocked] = useState(false);
  const [prepDismissed, setPrepDismissed] = useState(() => Object.keys(initialAnswers).length > 0);
  const [ackBoundary, setAckBoundary] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const pending = useRef<Record<string, number>>({});
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Текущее состояние синхронизации нужно внутри flush без пересоздания функции.
  const syncStateRef = useRef<"idle" | "offline" | "lost">("idle");
  const setSync = (s: "idle" | "offline" | "lost") => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, flush]);

  const currentItem = index < total ? items[index] : null;
  const prevItem = index > 0 ? items[index - 1] : null;
  const atBoundary =
    prepDismissed && !!prevItem && !!currentItem && prevItem.testIndex !== currentItem.testIndex && ackBoundary !== index;

  // Фокус переходит на заголовок нового вопроса, а не остаётся на кнопке прежнего ответа
  // (ТЗ аудита §6): иначе следующий вопрос читается с той точки, где стоял старый фокус.
  useEffect(() => {
    if (prepDismissed && !atBoundary && currentItem) headingRef.current?.focus();
  }, [index, atBoundary, prepDismissed, currentItem]);

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

  const saveState: SaveState = syncState === "lost" ? "lost" : syncState === "offline" ? "offline" : pendingCount > 0 ? "saving" : "saved";
  const saveStatus = (
    <SaveStatus
      state={saveState}
      texts={{ saving: t.saving, saved: t.saved, offline: t.offline, lost: t.sessionLost, reload: t.reload, retry: t.retry }}
      onRetry={() => void flush()}
    />
  );

  // Экран подготовки (UX-09): что за тестом и как он устроен, до первого вопроса.
  if (!prepDismissed) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <StageBreadcrumb current="test" labels={stages} />
        <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">{t.prep.title}</h1>
        <p className="mt-5 font-bold">{t.prep.blocksTitle}</p>
        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
          {t.prep.blocks.map((b, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                {i + 1}
              </span>
              {b}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-relaxed text-muted">{t.prep.afterBlocks}</p>
        <p className="mt-4 leading-relaxed">{t.prep.noRightAnswer}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.prep.autoAdvance}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.prep.saveNote}</p>
        <button
          type="button"
          onClick={() => setPrepDismissed(true)}
          className="focus-ring mt-6 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 sm:w-auto"
        >
          {t.prep.start}
        </button>
        <Link href="/start?new=1" className="focus-ring mt-4 block rounded py-2 text-sm font-semibold text-muted underline">
          {t.prep.back}
        </Link>
      </div>
    );
  }

  // Все вопросы отвечены.
  if (index >= total) {
    const saved = pendingCount === 0 && answeredCount === total;
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <ProgressBar value={100} />
        <h1 className="mt-8 text-2xl font-extrabold sm:text-3xl">{t.doneTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{t.doneText}</p>
        <div className="mt-6 space-y-4">
          {!saved && syncState !== "lost" && saveStatus}
          {(syncState === "lost" || syncState === "offline") && saveStatus}
          {saved && (
            <Link
              href="/survey"
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition-colors hover:bg-brand-600 active:bg-brand-700"
            >
              {t.continueToSurvey}
            </Link>
          )}
          <BackButton label={t.back} onClick={back} disabled={locked} />
        </div>
      </div>
    );
  }

  // Промежуточный экран между блоками (UX-11): что закончилось, что дальше, одна кнопка.
  if (atBoundary && currentItem) {
    const texts: Partial<Record<TestId, string>> = {
      riasec: t.interstitial.afterBigFive,
      values: t.interstitial.afterRiasec,
      perception: t.interstitial.afterValues,
    };
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <StageBreadcrumb current="test" labels={stages} />
        <ProgressBar value={progress} />
        <p className="mt-8 text-lg leading-relaxed" aria-live="polite">
          {texts[currentItem.test.id]}
        </p>
        <button
          type="button"
          onClick={() => setAckBoundary(index)}
          className="focus-ring mt-6 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 sm:w-auto"
        >
          {t.interstitial.continue}
        </button>
      </div>
    );
  }

  const item = items[index];
  const selected = answers[item.key];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <StageBreadcrumb current="test" labels={stages} />
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-brand-600">
          {fmt(t.partOf, { n: item.testIndex + 1, total: tests.length })} · {t.parts[item.test.id]}
        </p>
        <p className="shrink-0 text-muted">{fmt(t.blockProgress, { n: item.number, total: item.test.questions.length })}</p>
      </div>
      <ProgressBar value={progress} />

      <p className="mt-8 text-sm text-muted">{t.prompts[item.test.id]}</p>
      {/* Высота с запасом, чтобы кнопки не прыгали между короткими и длинными вопросами.
          tabIndex=-1 + ref: после ответа фокус явно переставляется сюда (см. useEffect выше). */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 min-h-[5.5rem] text-xl font-bold leading-snug sm:text-2xl"
        aria-live="polite"
      >
        {item.text}
      </h1>

      <div className="mt-4 grid gap-2.5" role="group" aria-label={t.prompts[item.test.id]}>
        {item.test.scaleLabels.map((s) => {
          const active = selected === s.value;
          return (
            <OptionButton
              key={s.value}
              active={active}
              disabled={locked}
              leading={<ScaleBadge value={s.value} active={active} />}
              onClick={() => answer(s.value)}
            >
              {s.label}
            </OptionButton>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <BackButton label={t.back} onClick={back} disabled={index === 0 || locked} />
          <button type="button" onClick={() => setPaused((p) => !p)} className="focus-ring min-h-11 rounded py-2 font-semibold text-muted">
            {t.pause}
          </button>
        </div>
        <PausePanel
          open={paused}
          onResume={() => setPaused(false)}
          texts={{ button: t.pause, title: t.pauseTitle, text: t.pauseText, resume: t.pauseResume, backHome: t.pauseBackHome }}
        />
        {saveStatus}
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
      className="focus-ring min-h-11 rounded py-2 font-semibold text-brand-600 disabled:text-slate-300"
    >
      ← {label}
    </button>
  );
}
