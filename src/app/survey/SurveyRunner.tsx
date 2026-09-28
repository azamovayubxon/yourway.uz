"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "@/i18n/format";
import { CheckBadge, OptionButton } from "@/components/ui";
import {
  BackIconButton,
  PartsNav,
  PauseButton,
  PausePanel,
  SaveStatus,
  primaryButtonClass,
  type FlowPart,
  type SaveState,
} from "@/components/flow";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PathType } from "@/lib/assessment/tests";

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

type SurveyDict = Dictionary["survey"];

interface Props {
  sessionId: string;
  sections: RunnerSurveySection[];
  initialAnswers: Record<string, SurveyValue>;
  t: SurveyDict;
  flow: Dictionary["flow"];
  pathType: PathType;
}

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

// Поля, которые показываем на экране «Проверьте ваши условия» перед генерацией (ТЗ аудита §6).
const REVIEW_FIELD_IDS = ["budget", "hours", "languages", "relocation"] as const;

export function SurveyRunner({ sessionId, sections, initialAnswers, t, flow, pathType }: Props) {
  const items = useMemo(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.questions.map((q, i) => ({ ...q, section, sectionIndex, number: i + 1 })),
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
  const [syncState, setSyncState] = useState<"idle" | "offline" | "lost">("idle");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [paused, setPaused] = useState(false);

  const pending = useRef<Record<string, SurveyValue>>({});
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStateRef = useRef<"idle" | "offline" | "lost">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
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

  // Фокус на заголовке нового вопроса, а не на кнопке прежнего ответа (ТЗ аудита §6).
  useEffect(() => {
    if (index < total) headingRef.current?.focus();
  }, [index, total]);

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

  function jumpTo(id: string) {
    const i = items.findIndex((x) => x.id === id);
    if (i !== -1) {
      setIndex(i);
      setReviewConfirmed(false);
      window.scrollTo({ top: 0 });
    }
  }

  const answeredCount = items.filter((item) => answers[item.id] !== undefined).length;
  const allSaved = index >= total && pendingCount === 0 && answeredCount === total;

  // Опрос пройден, всё сохранено на сервере и условия подтверждены → к генерации тизера.
  const router = useRouter();
  useEffect(() => {
    if (allSaved && reviewConfirmed && syncState === "idle") router.replace("/teaser");
  }, [allSaved, reviewConfirmed, syncState, router]);


  const saveState: SaveState = syncState === "lost" ? "lost" : syncState === "offline" ? "offline" : pendingCount > 0 ? "saving" : "saved";
  const saveStatus = (
    <SaveStatus
      state={saveState}
      texts={{ saving: t.saving, saved: t.saved, offline: t.offline, lost: t.sessionLost, reload: t.reload, retry: t.retry }}
      onRetry={() => void flush()}
    />
  );

  if (index >= total && !reviewConfirmed) {
    return (
      <ReviewScreen
        items={items}
        answers={answers}
        t={t.review}
        pathType={pathType}
        onEdit={jumpTo}
        onConfirm={() => setReviewConfirmed(true)}
      />
    );
  }

  if (index >= total) {
    const saved = allSaved;
    return (
      <div className="mx-auto max-w-[640px] px-4 pb-12 pt-10 text-center lg:pt-16">
        <h1 className="text-[28px] font-extrabold leading-tight lg:text-[40px]">{t.doneTitle}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{t.doneText}</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          {!saved && syncState !== "lost" && saveStatus}
          {(syncState === "lost" || syncState === "offline") && saveStatus}
          <button type="button" onClick={back} className="focus-ring min-h-11 rounded px-2 py-2 font-semibold text-muted underline-offset-4 hover:underline">
            ← {t.back}
          </button>
        </div>
      </div>
    );
  }

  const item = items[index];
  const value = answers[item.id];
  const titleId = `survey-q-${item.id}`;

  const parts: FlowPart[] = sections.map((section, i) => ({
    id: section.id,
    name: section.title,
    state: i < item.sectionIndex ? "done" : i === item.sectionIndex ? "current" : "upcoming",
    progress: i === item.sectionIndex ? Math.round(((item.number - 1) / section.questions.length) * 100) : undefined,
    counter: i === item.sectionIndex ? fmt(t.blockProgress, { n: item.number, total: section.questions.length }) : undefined,
  }));
  const pauseTexts = { button: t.pause, title: t.pauseTitle, text: t.pauseText, resume: t.pauseResume, backHome: t.pauseBackHome };

  // Тот же каркас, что у экрана вопроса теста (globals.css, .yw-flow): на компьютере слева
  // «Test ✓» и разделы анкеты, справа вопрос в карточке и варианты.
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12 pt-4 lg:max-w-6xl lg:pt-6">
      <div className="yw-flow">
        <div className="yw-flow-back">
          <BackIconButton label={t.back} onClick={back} disabled={index === 0} />
        </div>
        <div className="yw-flow-pause justify-self-end">
          <PauseButton label={t.pause} onClick={() => setPaused((p) => !p)} expanded={paused} />
        </div>
        <div className="yw-flow-panel mt-4 empty:hidden">
          <PausePanel open={paused} onResume={() => setPaused(false)} texts={pauseTexts} />
        </div>
        <aside className="yw-flow-parts mt-5 lg:mt-8">
          <PartsNav label={`${flow.brandLabel} · ${flow.stages.survey}`} parts={parts} lead={flow.stages.test} doneLabel={flow.partDone} />
        </aside>
        <section className="yw-flow-main mt-5 lg:mt-8 lg:pl-24">
          <div className="lg:max-w-[760px]">
            <div className="mb-5 hidden items-center gap-4 lg:flex">
              <BackIconButton label={t.back} onClick={back} disabled={index === 0} />
              <p className="text-sm text-muted">
                {fmt(t.partOf, { n: item.sectionIndex + 1, total: sections.length })} · {fmt(t.questionOf, { n: item.number, total: item.section.questions.length })}
              </p>
            </div>
            <div className="rounded-[28px] border border-line bg-white p-5 sm:p-7 lg:px-11 lg:py-9">
              <h1
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="rounded-md text-2xl font-bold leading-[1.2] focus-visible:outline-offset-4 sm:text-[26px] lg:text-[32px]"
                aria-live="polite"
              >
                <span key={item.id} className="yw-rise block">
                  {item.text}
                </span>
              </h1>
              {item.id === "gender" && <p className="mt-3 text-sm leading-relaxed text-muted">{t.genderHint}</p>}
              {item.type === "multi_select" && <p className="mt-3 text-sm font-semibold text-teal">{t.multiSelectHint}</p>}
            </div>
            <div className="mt-6 lg:mt-8">
              {item.type === "single_select" && (
                <SingleSelect
                  options={item.options}
                  value={typeof value === "string" ? value : undefined}
                  onPick={commit}
                  titleId={titleId}
                  hints={item.id === "english_level" ? t.englishHints : undefined}
                />
              )}
              {item.type === "multi_select" && (
                <MultiSelect
                  key={item.id}
                  options={item.options}
                  initialValue={Array.isArray(value) ? value : []}
                  required={item.required}
                  nextLabel={t.next}
                  onSubmit={commit}
                  titleId={titleId}
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
                  titleId={titleId}
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
                  placeholder={t.textPlaceholders[item.id as keyof typeof t.textPlaceholders]}
                  charCountFmt={t.charCount}
                  onSubmit={commit}
                  titleId={titleId}
                />
              )}
            </div>
          </div>
        </section>
        <div className="yw-flow-status mt-8 lg:mr-4 lg:mt-0 lg:max-w-md lg:justify-self-end">{saveStatus}</div>
      </div>
    </div>
  );
}

// Экран «Проверьте ваши условия» перед генерацией (ТЗ аудита §6): ключевые ответы одним
// взглядом, с кнопкой «Изменить» у каждого — переносит назад к нужному вопросу.
function ReviewScreen({
  items,
  answers,
  t,
  pathType,
  onEdit,
  onConfirm,
}: {
  items: (RunnerSurveyQuestion & { sectionIndex: number; number: number })[];
  answers: Record<string, SurveyValue>;
  t: SurveyDict["review"];
  pathType: PathType;
  onEdit: (id: string) => void;
  onConfirm: () => void;
}) {
  function labelFor(id: string): string {
    const item = items.find((x) => x.id === id);
    const value = answers[id];
    if (!item || value === undefined) return "—";
    if (Array.isArray(value)) {
      return value.map((v) => item.options.find((o) => o.value === v)?.label ?? v).join(", ");
    }
    if (typeof value === "string" && item.options.length > 0) {
      return item.options.find((o) => o.value === value)?.label ?? value;
    }
    return String(value);
  }

  const rows = REVIEW_FIELD_IDS.map((id) => ({ id, label: t.fields[id], value: labelFor(id) }));
  const goalItem = items.find((x) => x.id === "goal_text");

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12 pt-8 lg:pt-14">
      <h1 className="text-[28px] font-extrabold leading-tight lg:text-[40px]">{t.title}</h1>
      <p className="mt-3 leading-relaxed text-muted lg:text-lg">{t.intro}</p>
      <ul className="mt-6 divide-y divide-line rounded-[28px] border border-line bg-white px-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm text-muted">{row.label}</p>
              <p className="font-semibold">{row.value}</p>
            </div>
            <button type="button" onClick={() => onEdit(row.id)} className="focus-ring min-h-11 shrink-0 rounded-full px-3 font-semibold text-brand-600 hover:bg-brand-50">
              {t.edit}
            </button>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div>
            <p className="text-sm text-muted">{t.fields.goal}</p>
            <p className="font-semibold">{pathType === "knows_goal" && goalItem ? labelFor("goal_text") : t.goalPending}</p>
          </div>
          {pathType === "knows_goal" && goalItem && (
            <button type="button" onClick={() => onEdit("goal_text")} className="focus-ring min-h-11 shrink-0 rounded-full px-3 font-semibold text-brand-600 hover:bg-brand-50">
              {t.edit}
            </button>
          )}
        </li>
      </ul>
      <button type="button" onClick={onConfirm} className={primaryButtonClass + " mt-8"}>
        {t.confirm}
      </button>
    </div>
  );
}

function SingleSelect({
  options,
  value,
  onPick,
  titleId,
  hints,
}: {
  options: { value: string; label: string }[];
  value: string | undefined;
  onPick: (v: string) => void;
  titleId: string;
  hints?: Record<string, string>;
}) {
  return (
    <div className="grid gap-2.5" role="group" aria-labelledby={titleId}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <OptionButton key={o.value} active={active} onClick={() => onPick(o.value)} className={hints ? "!items-start" : ""}>
            <span className="block">{o.label}</span>
            {hints?.[o.value] && (
              <span className="mt-0.5 block text-sm font-normal text-muted">{hints[o.value]}</span>
            )}
          </OptionButton>
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
  titleId,
}: {
  options: { value: string; label: string }[];
  initialValue: string[];
  required: boolean;
  nextLabel: string;
  onSubmit: (v: string[]) => void;
  titleId: string;
}) {
  const [selected, setSelected] = useState<string[]>(initialValue);

  function toggle(v: string) {
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <div>
      <div className="grid gap-2.5" role="group" aria-labelledby={titleId}>
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <OptionButton key={o.value} active={active} leading={<CheckBadge active={active} />} onClick={() => toggle(o.value)}>
              {o.label}
            </OptionButton>
          );
        })}
      </div>
      <button
        type="button"
        disabled={required && selected.length === 0}
        onClick={() => onSubmit(selected)}
        className={primaryButtonClass + " mt-6"}
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
  titleId,
}: {
  initialValue: number | undefined;
  min: number | undefined;
  max: number | undefined;
  nextLabel: string;
  rangeLabel: string;
  onSubmit: (v: number) => void;
  titleId: string;
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
        aria-labelledby={titleId}
        onChange={(e) => setText(e.target.value)}
        className="focus-ring min-h-16 w-full rounded-3xl border-2 border-line bg-white px-5 py-3 font-display text-2xl font-bold focus:border-brand-500 sm:max-w-60"
        autoFocus
      />
      <p className="mt-2 text-sm text-muted">{rangeLabel}</p>
      <button type="submit" disabled={!valid} className={primaryButtonClass + " mt-6"}>
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
  placeholder,
  charCountFmt,
  onSubmit,
  titleId,
}: {
  initialValue: string;
  maxLen: number | undefined;
  required: boolean;
  nextLabel: string;
  skipLabel: string;
  placeholder?: string;
  charCountFmt: string;
  onSubmit: (v: string) => void;
  titleId: string;
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
        placeholder={placeholder}
        aria-labelledby={titleId}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="focus-ring w-full rounded-3xl border-2 border-line bg-white px-5 py-4 text-base leading-relaxed placeholder:text-muted focus:border-brand-500"
        autoFocus
      />
      {maxLen !== undefined && (
        <p className="mt-1.5 text-right text-xs text-muted">{fmt(charCountFmt, { used: text.length, max: maxLen })}</p>
      )}
      <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
        <button type="submit" disabled={required && trimmed === ""} className={primaryButtonClass}>
          {nextLabel}
        </button>
        {!required && (
          <button
            type="button"
            onClick={() => onSubmit("")}
            className="focus-ring min-h-12 w-full rounded-full border border-line bg-white px-6 font-semibold text-muted transition-colors hover:border-brand-500 hover:text-ink sm:w-auto"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </form>
  );
}
