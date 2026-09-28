"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TestId } from "@/lib/assessment/tests";
import type { Dictionary } from "@/i18n/dictionaries";
import { estimateMinutes, fmt, fmtCount } from "@/i18n/format";
import {
  BackIconButton,
  CheckIcon,
  FlowLabel,
  LikertScale,
  PartNumber,
  PartsNav,
  PauseButton,
  PausePanel,
  SaveStatus,
  primaryButtonClass,
  type FlowPart,
  type SaveState,
} from "@/components/flow";

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
  flow: Dictionary["flow"];
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

export function TestRunner({ sessionId, tests, initialAnswers, t, flow }: Props) {
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

  // Клавиши 1–5 выбирают ответ (подсказка — в колонке слева на компьютере). Не срабатывают, когда
  // фокус в поле ввода, открыта пауза, на экранах подготовки/между частями и с Ctrl/Alt/Cmd.
  // Стрелки по-прежнему двигают фокус внутри шкалы (LikertScale), Enter/Space — выбирают.
  const onQuestion = prepDismissed && !atBoundary && index < total && !paused;
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });
  useEffect(() => {
    if (!onQuestion) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const n = Number(e.key);
      const option = Number.isInteger(n) ? items[index]?.test.scaleLabels[n - 1] : undefined;
      if (!option) return;
      e.preventDefault();
      answerRef.current(option.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onQuestion, index, items]);

  const answeredCount = items.filter((item) => answers[item.key] !== undefined).length;

  const saveState: SaveState = syncState === "lost" ? "lost" : syncState === "offline" ? "offline" : pendingCount > 0 ? "saving" : "saved";
  const saveStatus = (
    <SaveStatus
      state={saveState}
      texts={{ saving: t.saving, saved: t.saved, offline: t.offline, lost: t.sessionLost, reload: t.reload, retry: t.retry }}
      onRetry={() => void flush()}
    />
  );

  const flowLabel = `${flow.brandLabel} · ${flow.stages.test}`;
  const pauseTexts = { button: t.pause, title: t.pauseTitle, text: t.pauseText, resume: t.pauseResume, backHome: t.pauseBackHome };
  const pausePanel = <PausePanel open={paused} onResume={() => setPaused(false)} texts={pauseTexts} />;

  // Экран подготовки (UX-09): что за тестом и как он устроен, до первого вопроса.
  // Телефон — одна колонка; компьютер — слева заголовок, правила и кнопки, справа сетка 2×2 частей.
  if (!prepDismissed) {
    const minutes = estimateMinutes(total);
    return (
      <div className="mx-auto max-w-[640px] px-4 pb-12 pt-8 lg:max-w-6xl lg:pt-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-16">
          <div>
            <FlowLabel>{flow.brandLabel}</FlowLabel>
            <h1 className="mt-3 text-[32px] font-extrabold leading-[1.1] lg:text-6xl">{t.prep.title}</h1>
            <p className="mt-3 text-muted lg:mt-5 lg:text-lg">{fmt(t.prep.subtitle, { parts: tests.length, min: minutes })}</p>
            <ol className="mt-6 grid gap-3 lg:hidden">
              {tests.map((test, i) => (
                <PrepPart key={test.id} n={i + 1} name={t.prep.blocks[i] ?? t.parts[test.id]} hint={t.prep.blockHints[i]} count={fmtCount(t.questionsCount, test.questions.length)} />
              ))}
            </ol>
            <ul className="mt-4 space-y-2.5 rounded-3xl bg-sand p-5 text-[15px] leading-snug lg:mt-8">
              {t.prep.rules.map((rule) => (
                <li key={rule} className="flex gap-2.5">
                  <CheckIcon className="mt-0.5 size-4 text-teal" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t.prep.afterBlocks}</p>
            <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
              <button type="button" onClick={() => setPrepDismissed(true)} className={primaryButtonClass}>
                {t.prep.start}
              </button>
              <Link href="/start?new=1" className="focus-ring rounded px-2 py-3 text-sm font-semibold text-muted underline-offset-4 hover:underline">
                {t.prep.back}
              </Link>
            </div>
          </div>
          <ol className="hidden grid-cols-2 gap-5 lg:grid">
            {tests.map((test, i) => (
              <PrepPart key={test.id} wide n={i + 1} name={t.prep.blocks[i] ?? t.parts[test.id]} hint={t.prep.blockHints[i]} count={fmtCount(t.questionsCount, test.questions.length)} />
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // Все вопросы отвечены.
  if (index >= total) {
    const saved = pendingCount === 0 && answeredCount === total;
    return (
      <CenteredStep>
        <PartSegments done={tests.length} total={tests.length} label={fmt(t.interstitial.progress, { n: tests.length, total: tests.length })} />
        <DoneBurst />
        <h1 className="mt-8 text-center text-[28px] font-extrabold leading-tight lg:text-[40px]">{t.doneTitle}</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-lg leading-relaxed text-muted">{t.doneText}</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          {!saved && syncState !== "lost" && saveStatus}
          {(syncState === "lost" || syncState === "offline") && saveStatus}
          {saved && (
            <Link href="/survey" className={primaryButtonClass}>
              {t.continueToSurvey}
            </Link>
          )}
          <button
            type="button"
            onClick={back}
            disabled={locked}
            className="focus-ring min-h-11 rounded px-2 py-2 font-semibold text-muted underline-offset-4 hover:underline"
          >
            ← {t.back}
          </button>
        </div>
      </CenteredStep>
    );
  }

  // Промежуточный экран между блоками (UX-11): что закончилось, что дальше, одна кнопка.
  if (atBoundary && currentItem) {
    const texts: Partial<Record<TestId, string>> = {
      riasec: t.interstitial.afterBigFive,
      values: t.interstitial.afterRiasec,
      perception: t.interstitial.afterValues,
    };
    const finished = currentItem.testIndex; // сколько частей уже пройдено
    const next = currentItem.test;
    const nextCount = next.questions.length;
    return (
      <CenteredStep>
        <PartSegments done={finished} total={tests.length} label={fmt(t.interstitial.progress, { n: finished, total: tests.length })} />
        <DoneBurst />
        <div aria-live="polite">
          <h1 className="mt-8 text-center text-[28px] font-extrabold leading-tight lg:text-[40px]">{fmt(t.interstitial.title, { n: finished })}</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-lg leading-relaxed text-muted">{texts[next.id]}</p>
        </div>
        <div className="mx-auto mt-6 flex w-fit max-w-full items-center gap-3 rounded-3xl border border-line bg-white px-4 py-3">
          <PartNumber n={currentItem.testIndex + 1} />
          <div className="min-w-0">
            <p className="font-display font-bold leading-tight">{t.parts[next.id]}</p>
            <p className="text-sm text-muted">
              {fmt(t.interstitial.nextMeta, { questions: fmtCount(t.questionsCount, nextCount), min: estimateMinutes(nextCount) })}
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2">
          <button type="button" onClick={() => setAckBoundary(index)} className={primaryButtonClass + " sm:min-w-72"}>
            {t.interstitial.continue}
          </button>
          <button
            type="button"
            onClick={() => setPaused(true)}
            aria-expanded={paused}
            className="focus-ring min-h-11 rounded px-2 py-2 text-sm font-semibold text-muted underline-offset-4 hover:underline"
          >
            {t.interstitial.pauseLink}
          </button>
        </div>
        {paused && <div className="mt-4">{pausePanel}</div>}
      </CenteredStep>
    );
  }

  const item = items[index];
  const selected = answers[item.key];
  const headingId = "test-question";
  const parts: FlowPart[] = tests.map((test, i) => ({
    id: test.id,
    name: t.parts[test.id],
    state: i < item.testIndex ? "done" : i === item.testIndex ? "current" : "upcoming",
    count: test.questions.length,
    countLabel: fmtCount(t.questionsCount, test.questions.length),
    progress: i === item.testIndex ? Math.round(((item.number - 1) / test.questions.length) * 100) : undefined,
    counter: i === item.testIndex ? fmt(t.blockProgress, { n: item.number, total: test.questions.length }) : undefined,
  }));

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12 pt-4 lg:max-w-6xl lg:pt-6">
      <div className="yw-flow">
        <div className="yw-flow-back">
          <BackIconButton label={t.back} onClick={back} disabled={index === 0 || locked} />
        </div>
        <div className="yw-flow-pause justify-self-end">
          <PauseButton label={t.pause} onClick={() => setPaused((p) => !p)} expanded={paused} />
        </div>
        <div className="yw-flow-panel mt-4 empty:hidden">{pausePanel}</div>
        <aside className="yw-flow-parts mt-5 lg:mt-8">
          <PartsNav label={flowLabel} parts={parts} doneLabel={flow.partDone} />
          <p className="mt-10 hidden rounded-3xl bg-sand p-4 text-sm leading-relaxed text-muted lg:block">
            <KeyHint text={t.keyboardHint} />
          </p>
        </aside>
        <section className="yw-flow-main mt-5 lg:mt-8 lg:pl-24">
          <div className="lg:max-w-[760px]">
            <div className="mb-5 hidden items-center gap-4 lg:flex">
              <BackIconButton label={t.back} onClick={back} disabled={index === 0 || locked} />
              <p className="text-sm text-muted">{fmt(t.questionOf, { n: item.number, total: item.test.questions.length })}</p>
            </div>
            <div className="rounded-[28px] border border-line bg-white p-5 sm:p-7 lg:px-11 lg:py-10">
              <p id="test-prompt" key={`p-${item.test.id}`} className="yw-rise text-sm font-bold text-teal lg:text-base">
                {t.prompts[item.test.id]}
              </p>
              {/* Высота с запасом, чтобы шкала не прыгала между короткими и длинными вопросами.
                  tabIndex=-1 + ref: после ответа фокус явно переставляется сюда (см. useEffect выше).
                  Сам h1 не пересоздаётся (живая область), анимируется только текст внутри. */}
              <h1
                id={headingId}
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 min-h-[6.5rem] rounded-md text-2xl font-bold leading-[1.2] focus-visible:outline-offset-4 sm:text-[26px] lg:min-h-[8.5rem] lg:text-[34px]"
                aria-live="polite"
              >
                <span key={item.key} className="yw-rise block">
                  {item.text}
                </span>
              </h1>
            </div>
            <div className="mt-8 lg:mt-10">
              <LikertScale
                key={item.key}
                options={item.test.scaleLabels}
                value={selected}
                onPick={answer}
                disabled={locked}
                labelledBy={headingId}
                placeholder={t.chooseAnswer}
              />
            </div>
          </div>
        </section>
        <div className="yw-flow-status mt-8 lg:mr-4 lg:mt-0 lg:max-w-md lg:justify-self-end">{saveStatus}</div>
      </div>
    </div>
  );
}

// Одна колонка по центру (до 640px): экраны между частями и «тест пройден».
function CenteredStep({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[640px] px-4 pb-12 pt-6 lg:pt-10">{children}</div>;
}

// Четыре сегмента общего прогресса: пройденные — терракотой. Подпись — строкой ниже.
function PartSegments({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={"h-1.5 flex-1 rounded-full " + (i < done ? "bg-brand-500" : "bg-line")} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

// Направления разлёта точек-конфетти (px) и их цвета.
const CONFETTI: { dx: number; dy: number; color: string }[] = [
  { dx: -92, dy: -58, color: "bg-brand-500" },
  { dx: -70, dy: 48, color: "bg-sun" },
  { dx: -30, dy: -96, color: "bg-teal" },
  { dx: 24, dy: -100, color: "bg-sun" },
  { dx: 76, dy: -66, color: "bg-brand-500" },
  { dx: 98, dy: 6, color: "bg-teal" },
  { dx: 70, dy: 62, color: "bg-sun" },
  { dx: 10, dy: 96, color: "bg-brand-500" },
  { dx: -100, dy: 0, color: "bg-teal" },
  { dx: -42, dy: 88, color: "bg-brand-500" },
];

// Бирюзовый круг с галочкой: «выскакивает» и вокруг разлетаются точки (CSS, ~1.5 с, один раз).
// При «уменьшить движение» — просто круг, без конфетти (см. globals.css).
function DoneBurst() {
  return (
    <div className="relative mx-auto mt-10 flex size-28 items-center justify-center lg:mt-14 lg:size-32" aria-hidden>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={"yw-confetti absolute left-1/2 top-1/2 -ml-1 -mt-1 size-2 rounded-full " + c.color}
          style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px` } as CSSProperties}
        />
      ))}
      <span className="yw-pop flex size-full items-center justify-center rounded-full bg-teal text-white">
        <CheckIcon className="size-12" />
      </span>
    </div>
  );
}

// Карточка части на экране «Перед началом»: цветной номер, название, подпись, число вопросов.
function PrepPart({ n, name, hint, count, wide = false }: { n: number; name: string; hint?: string; count: string; wide?: boolean }) {
  if (wide) {
    return (
      <li className="flex flex-col rounded-[28px] border border-line bg-white p-6">
        <PartNumber n={n} size="lg" />
        <p className="mt-4 font-display text-xl font-bold leading-tight">{name}</p>
        {hint && <p className="mt-2 text-muted">{hint}</p>}
        <p className="mt-2 text-sm text-muted">{count}</p>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3.5 rounded-3xl border border-line bg-white p-4">
      <PartNumber n={n} />
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold leading-tight">{name}</p>
        {hint && <p className="mt-0.5 text-sm leading-snug text-muted">{hint}</p>}
      </div>
      <p className="shrink-0 text-sm text-muted">{count}</p>
    </li>
  );
}

// «…клавиши от 1 до 5»: цифры в подсказке — жирным.
function KeyHint({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d)/).map((part, i) =>
        /^\d$/.test(part) ? (
          <b key={i} className="font-bold text-ink">
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}
