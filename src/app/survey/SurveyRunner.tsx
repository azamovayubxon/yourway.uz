"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "@/i18n/format";

// Прохождение контекстного опроса: один вопрос на экран, как в TestRunner, но с разными
// типами вопросов (число, один вариант, несколько вариантов, текст). Автосохранение —
// тот же механизм, что в TestRunner: очередь в localStorage + отправка на сервер.

export type SurveyValue = number | string | string[];

export interface RunnerSurveyQuestion {
  id: string;
  type: "number" | "single_select" | "multi_select" | "text";
  required: boolean;
  text: string;
  options: { value: string; label: string }[];
  input: { min?: number; max?: number; maxLen?: number };
}

export interface RunnerSurveySection {
  id: string;
  title: string;
  questions: RunnerSurveyQuestion[];
}

interface SurveyDict {
  next: string;
  skip: string;
  back: string;
  partOf: string;
  questionOf: string;
  numberRange: string;
  offline: string;
  sessionLost: string;
  reload: string;
  saving: string;
  devLink: string;
  doneTitle: string;
  doneText: string;
}

interface Props {
  sessionId: string;
  sections: RunnerSurveySection[];
  initialAnswers: Record<string, SurveyValue>;
  t: SurveyDict;
  devProfileHref: string | null;
}

type SyncState = "idle" | "offline" | "lost";

const RETRY_MS = 4000;

const pendingKey = (sessionId: string) => `yw_survey_pending:${sessionId}`;

function readPending(sessionId: string): Record<string, SurveyValue> {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(sessionId)) ?? "{}");
  } catch {
    return {};
  }
}

function writePending(sessionId: string, pending: Record<string, SurveyValue>) {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(pendingKey(sessionId));
    else localStorage.setItem(pendingKey(sessionId), JSON.stringify(pending));
  } catch {
    // Хранилище недоступно (приватный режим): ответы всё равно отправляются на сервер.
  }
}

export function SurveyRunner({ sessionId, sections, initialAnswers, t, devProfileHref }: Props) {
  const items = useMemo(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.questions.map((q) => ({ ...q, section, sectionIndex })),
      ),
    [sections],
  );
  const total = items.length;

  const firstUnanswered = (answers: Record<string, SurveyValue>) => {
    const i = items.findIndex((item) => answers[item.id] === undefined);
    return i === -1 ? total : i;
  };

  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(() => firstUnanswered(initialAnswers));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");

  const pending = useRef<Record<string, SurveyValue>>({});
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const res = await fetch("/api/session/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answers: keys.map((questionId) => ({ questionId, value: snapshot[questionId] })),
        }),
      });
      if (res.status === 409) {
        setSync("lost");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    // Только при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, flush]);

  function commit(value: SurveyValue) {
    const key = items[index].id;
    setAnswers((prev) => ({ ...prev, [key]: value }));
    pending.current[key] = value;
    writePending(sessionId, pending.current);
    setPendingCount(Object.keys(pending.current).length);
    void flush();
    setIndex((i) => Math.min(i + 1, total));
    window.scrollTo({ top: 0 });
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  const answeredCount = items.filter((item) => answers[item.id] !== undefined).length;
  const allSaved = index >= total && pendingCount === 0 && answeredCount === total;

  // Опрос пройден и всё сохранено на сервере → сразу к генерации тизера (Приложение А §11, шаг 7).
  const router = useRouter();
  useEffect(() => {
    if (allSaved && syncState === "idle") router.replace("/teaser");
  }, [allSaved, syncState, router]);

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

  if (index >= total) {
    const saved = allSaved;
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <ProgressBar value={100} />
        <h1 className="mt-8 text-2xl font-extrabold sm:text-3xl">{t.doneTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{t.doneText}</p>
        <div className="mt-6 space-y-4">
          {!saved && syncState !== "lost" && <p className="text-sm text-muted">{t.saving}</p>}
          {status}
          {saved && devProfileHref && (
            <Link href={devProfileHref} className="block py-2 font-semibold text-brand-600">
              {t.devLink} →
            </Link>
          )}
          <BackButton label={t.back} onClick={back} disabled={false} />
        </div>
      </div>
    );
  }

  const item = items[index];
  const value = answers[item.id];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-brand-600">
          {fmt(t.partOf, { n: item.sectionIndex + 1, total: sections.length })} · {item.section.title}
        </p>
        <p className="shrink-0 text-muted">{fmt(t.questionOf, { n: index + 1, total })}</p>
      </div>
      <ProgressBar value={progress} />

      <h1 className="mt-8 min-h-[5.5rem] text-xl font-bold leading-snug sm:text-2xl" aria-live="polite">
        {item.text}
      </h1>

      <div className="mt-4">
        {item.type === "single_select" && (
          <SingleSelect options={item.options} value={typeof value === "string" ? value : undefined} onPick={commit} />
        )}
        {item.type === "multi_select" && (
          <MultiSelect
            key={item.id}
            options={item.options}
            initialValue={Array.isArray(value) ? value : []}
            required={item.required}
            nextLabel={t.next}
            onSubmit={commit}
          />
        )}
        {item.type === "number" && (
          <NumberInput
            key={item.id}
            initialValue={typeof value === "number" ? value : undefined}
            min={item.input.min}
            max={item.input.max}
            nextLabel={t.next}
            rangeLabel={fmt(t.numberRange, { min: item.input.min ?? "", max: item.input.max ?? "" })}
            onSubmit={commit}
          />
        )}
        {item.type === "text" && (
          <TextInput
            key={item.id}
            initialValue={typeof value === "string" ? value : ""}
            maxLen={item.input.maxLen}
            required={item.required}
            nextLabel={t.next}
            skipLabel={t.skip}
            onSubmit={commit}
          />
        )}
      </div>

      <div className="mt-6 space-y-4">
        <BackButton label={t.back} onClick={back} disabled={index === 0} />
        {status}
      </div>
    </div>
  );
}

function SingleSelect({
  options,
  value,
  onPick,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onPick: (v: string) => void;
}) {
  return (
    <div className="grid gap-2.5" role="group">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            aria-pressed={active}
            className={
              "min-h-14 w-full rounded-2xl border-2 px-4 py-2.5 text-left font-medium leading-tight transition-colors " +
              (active
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-slate-200 bg-white hover:border-brand-500 active:bg-brand-50")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// key={item.id} на месте вызова пересоздаёт компонент при переходе к другому вопросу —
// это и есть синхронизация с initialValue. Без нового монтирования локальный черновик
// (что человек уже отметил/напечатал) не должен сбрасываться фоновым автосохранением
// других ответов: оно перерисовывает SurveyRunner, но не должно перерисовывать это поле.
function MultiSelect({
  options,
  initialValue,
  required,
  nextLabel,
  onSubmit,
}: {
  options: { value: string; label: string }[];
  initialValue: string[];
  required: boolean;
  nextLabel: string;
  onSubmit: (v: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialValue);

  function toggle(v: string) {
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <div>
      <div className="grid gap-2.5" role="group">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              aria-pressed={active}
              className={
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left font-medium leading-tight transition-colors " +
                (active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white hover:border-brand-500 active:bg-brand-50")
              }
            >
              <span
                className={
                  "flex size-6 shrink-0 items-center justify-center rounded-md border-2 text-xs " +
                  (active ? "border-white bg-white text-brand-600" : "border-slate-300")
                }
              >
                {active ? "✓" : ""}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={required && selected.length === 0}
        onClick={() => onSubmit(selected)}
        className="mt-4 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function NumberInput({
  initialValue,
  min,
  max,
  nextLabel,
  rangeLabel,
  onSubmit,
}: {
  initialValue: number | undefined;
  min: number | undefined;
  max: number | undefined;
  nextLabel: string;
  rangeLabel: string;
  onSubmit: (v: number) => void;
}) {
  const [text, setText] = useState(initialValue !== undefined ? String(initialValue) : "");
  const n = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(n) && (min === undefined || n >= min) && (max === undefined || n <= max);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(n);
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold focus:border-brand-500 focus:outline-none"
        autoFocus
      />
      <p className="mt-2 text-sm text-muted">{rangeLabel}</p>
      <button
        type="submit"
        disabled={!valid}
        className="mt-4 min-h-12 w-full rounded-2xl bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400"
      >
        {nextLabel}
      </button>
    </form>
  );
}

function TextInput({
  initialValue,
  maxLen,
  required,
  nextLabel,
  skipLabel,
  onSubmit,
}: {
  initialValue: string;
  maxLen: number | undefined;
  required: boolean;
  nextLabel: string;
  skipLabel: string;
  onSubmit: (v: string) => void;
}) {
  const [text, setText] = useState(initialValue);
  const trimmed = text.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (required && trimmed === "") return;
        onSubmit(trimmed);
      }}
    >
      <textarea
        value={text}
        maxLength={maxLen}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base focus:border-brand-500 focus:outline-none"
        autoFocus
      />
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={required && trimmed === ""}
          className="min-h-12 flex-1 rounded-2xl bg-brand-500 px-6 font-bold text-white transition-colors hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {nextLabel}
        </button>
        {!required && (
          <button
            type="button"
            onClick={() => onSubmit("")}
            className="min-h-12 px-4 font-semibold text-muted"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </form>
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
