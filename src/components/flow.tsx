"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// Общие кусочки прохождения теста и опроса (этап B1, ТЗ аудита §6; новый стиль — этап 2а):
// список частей с прогрессом, шкала-круги, кнопки «Назад»/«Пауза», статус сохранения по факту.
// Используются и в TestRunner, и в SurveyRunner — чтобы вид не расходился между экранами.

// Цвет номера части: 1 — терракота, 2 — бирюза, 3 — солнечный (с тёмной цифрой), 4 — тёмный.
// Приглушённые варианты — для остальных частей в колонке слева на компьютере.
const PART_TONES = ["bg-brand-500 text-white", "bg-teal text-white", "bg-sun text-ink", "bg-ink text-on-dark"];
const PART_TONES_SOFT = ["bg-brand-50 text-brand-600", "bg-teal-50 text-teal", "bg-sun-50 text-ink", "bg-sand text-ink"];

export function PartNumber({
  n,
  soft = false,
  size = "md",
  className = "",
}: {
  n: number;
  soft?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = soft ? PART_TONES_SOFT : PART_TONES;
  const box = size === "lg" ? "size-12 rounded-2xl text-lg" : size === "sm" ? "size-8 rounded-xl text-sm" : "size-10 rounded-xl text-base";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-display font-bold ${box} ${tones[(n - 1) % tones.length]} ${className}`}
    >
      {n}
    </span>
  );
}

// Метка над экраном: «KASB YOʻLI · TEST». Бирюзовая, заглавными, мелко.
export function FlowLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={"text-xs font-bold uppercase tracking-[0.14em] text-teal " + className}>{children}</p>;
}

export function ProgressBar({ value, label, valueText, className = "" }: { value: number; label: string; valueText?: string; className?: string }) {
  return (
    <div
      className={"h-2 overflow-hidden rounded-full bg-line " + className}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
    >
      <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}

export interface FlowPart {
  id: string;
  name: string;
  state: "done" | "current" | "upcoming";
  count?: number; // вопросов в части (для приглушённых карточек на компьютере)
  countLabel?: string; // то же словами: «30 ta savol» (для экранных читалок)
  progress?: number; // только у текущей: 0–100 внутри части
  counter?: string; // только у текущей: «11/60»
}

// Части прохождения. Один и тот же список в двух раскладках:
//  • телефон — строка текущей части (номер, название, прогресс, «11/60») и под ней маленькие
//    плашки оставшихся частей (у третьей и дальше — только номер, название — для читалок);
//  • компьютер (lg) — колонка карточек: текущая с терракотовой рамкой и прогрессом, остальные
//    приглушены, с числом вопросов; пройденные — с галочкой.
// `lead` — пройденный этап перед этими частями (в анкете: «Test ✓»), виден только на компьютере.
export function PartsNav({
  label,
  parts,
  lead,
  doneLabel,
}: {
  label: string;
  parts: FlowPart[];
  lead?: string;
  doneLabel: string;
}) {
  let upcomingSeen = 0;
  return (
    <nav aria-label={label}>
      <FlowLabel className="hidden lg:block">{label}</FlowLabel>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 lg:mt-4 lg:flex-col lg:items-stretch lg:gap-3">
        {lead && (
          <li className="hidden items-center gap-3 rounded-3xl border border-line bg-white px-4 py-3 lg:flex">
            <DoneMark />
            <span className="flex-1 font-semibold text-muted">{lead}</span>
            <span className="sr-only">— {doneLabel}</span>
          </li>
        )}
        {parts.map((p, i) => {
          const n = i + 1;
          if (p.state === "current") {
            return (
              <li
                key={p.id}
                aria-current="step"
                className="mb-1 basis-full lg:mb-0 lg:rounded-3xl lg:border-2 lg:border-brand-500 lg:bg-white lg:p-4"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                  <PartNumber n={n} className="row-span-2 lg:row-span-1 lg:size-9 lg:text-sm" />
                  <span className="truncate font-display font-bold leading-tight text-ink">{p.name}</span>
                  <span className="row-span-2 text-sm tabular-nums text-muted lg:row-span-1 lg:text-xs">{p.counter}</span>
                  <ProgressBar
                    value={p.progress ?? 0}
                    label={p.name}
                    valueText={p.counter}
                    className="col-start-2 lg:col-span-3 lg:col-start-1 lg:mt-2"
                  />
                </div>
              </li>
            );
          }
          if (p.state === "done") {
            return (
              <li key={p.id} className="hidden items-center gap-3 rounded-3xl border border-line bg-white px-4 py-3 lg:flex">
                <DoneMark />
                <span className="flex-1 text-muted">{p.name}</span>
                <span className="sr-only">— {doneLabel}</span>
              </li>
            );
          }
          upcomingSeen += 1;
          const nameHiddenOnPhone = upcomingSeen > 2;
          return (
            <li
              key={p.id}
              className={
                "flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs text-muted " +
                "lg:gap-3 lg:rounded-3xl lg:border lg:border-line lg:bg-white lg:px-4 lg:py-3 lg:text-base " +
                (upcomingSeen === 1 ? "max-lg:ml-[52px]" : "")
              }
            >
              <span className="lg:hidden" aria-hidden>
                {n}
                {!nameHiddenOnPhone && " ·"}
              </span>
              <PartNumber n={n} soft size="sm" className="hidden lg:flex" />
              <span className={"lg:flex-1 " + (nameHiddenOnPhone ? "max-lg:sr-only" : "")}>{p.name}</span>
              {p.count !== undefined && (
                <>
                  <span aria-hidden className="hidden text-xs tabular-nums lg:inline">
                    {p.count}
                  </span>
                  {p.countLabel && <span className="sr-only">({p.countLabel})</span>}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function DoneMark() {
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal">
      <CheckIcon className="size-4" />
    </span>
  );
}

export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={"shrink-0 " + className} aria-hidden focusable="false">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

// Круглая кнопка «Назад» с иконкой; подпись — только для читалок (aria-label из словаря).
export function BackIconButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-full bg-sand text-ink transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sand disabled:hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden focusable="false">
        <path d="M14.5 6 8.5 12l6 6" />
      </svg>
    </button>
  );
}

export function PauseButton({ label, onClick, expanded }: { label: string; onClick: () => void; expanded: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="focus-ring min-h-11 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-brand-500"
    >
      {label}
    </button>
  );
}

// Основная кнопка прохождения — большая, терракотовая, круглая.
export const primaryButtonClass =
  "focus-ring inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-500 px-8 text-lg font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted sm:w-auto";

export type SaveState = "saving" | "saved" | "offline" | "lost";

export interface SaveStatusTexts {
  saving: string;
  saved: string;
  offline: string;
  lost: string;
  reload: string;
  retry: string;
}

// Показывает ровно то состояние, которое есть на самом деле (ТЗ: «Сохраняем… / Сохранено /
// Не удалось сохранить. Повторить» — только по фактическому состоянию, не декоративно).
export function SaveStatus({ state, texts, onRetry }: { state: SaveState; texts: SaveStatusTexts; onRetry?: () => void }) {
  if (state === "lost") {
    return (
      <p role="status" className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
        {texts.lost}{" "}
        <button type="button" onClick={() => window.location.reload()} className="focus-ring rounded font-semibold underline">
          {texts.reload}
        </button>
      </p>
    );
  }
  if (state === "offline") {
    return (
      <p role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun-50 px-4 py-3 text-sm text-ink">
        <span>{texts.offline}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="focus-ring min-h-11 shrink-0 rounded font-semibold underline">
            {texts.retry}
          </button>
        )}
      </p>
    );
  }
  if (state === "saving") {
    return (
      <p role="status" className="text-sm text-muted">
        {texts.saving}
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm text-muted">
      <CheckIcon className="size-3.5 text-teal" />
      {texts.saved}
    </p>
  );
}

export interface PauseTexts {
  button: string;
  title: string;
  text: string;
  resume: string;
  backHome: string;
}

// «Пауза»: не отдельный экран, а честное объяснение прямо тут же — ответы и так сохраняются
// на сервере по мере ответа, поэтому «пауза» — это просто безопасно уйти и знать, куда вернуться.
export function PausePanel({ open, texts, onResume }: { open: boolean; texts: PauseTexts; onResume: () => void }) {
  if (!open) return null;
  return (
    <div role="status" className="rounded-3xl border border-line bg-sand p-5 text-sm">
      <p className="font-display text-base font-bold text-ink">{texts.title}</p>
      <p className="mt-1.5 leading-relaxed text-muted">{texts.text}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={onResume}
          className="focus-ring min-h-11 rounded-full bg-brand-500 px-5 font-semibold text-white transition-colors hover:bg-brand-600"
        >
          {texts.resume}
        </button>
        <a href="/" className="focus-ring rounded py-2 font-semibold text-muted underline">
          {texts.backHome}
        </a>
      </div>
    </div>
  );
}

// ——— Шкала-круги (этап 2а) ———
// Пять кругов в ряд: крайние крупнее, к центру меньше. Левые два — терракота, центр — #8A8478
// (faint: только обводка/заливка, не текст), правые два — бирюза. Выбранный круг заливается.
// Доступность: role="radiogroup" + role="radio" с aria-checked; доступное имя круга — полная
// подпись варианта. Один круг в порядке Tab (выбранный, иначе первый), ←/→ (и ↑/↓, Home/End)
// двигают фокус, НЕ выбирая ответ (выбор = автопереход к следующему вопросу), Enter/Space —
// выбирают. Область нажатия каждого круга не меньше 44×44 (маленький — за счёт отступа); меньше
// только если сама шкала уже 232px (увеличение текста 200% на телефоне) — иначе ряд не помещается.
// Клавиши 1–5 обрабатывает сам экран (TestRunner): им нужна логика ответа и паузы.

const SCALE_TONES = ["brand", "brand", "neutral", "teal", "teal"] as const;
type ScaleTone = (typeof SCALE_TONES)[number];

// Размер круга: телефон ≈60 / 48 / 38 px, компьютер ≈76 / 60 / 46 px. На узкой шкале круги
// уменьшаются вместе с ней (cqw — доля ширины самой шкалы, она — container): так ряд помещается и
// на телефоне 320px, и при увеличении текста до 200%, не вылезая за экран.
const CIRCLE_SIZE = [
  "size-[min(60px,17.5cqw)] lg:size-[76px]",
  "size-[min(48px,14cqw)] lg:size-[60px]",
  "size-[min(38px,11cqw)] lg:size-[46px]",
  "size-[min(48px,14cqw)] lg:size-[60px]",
  "size-[min(60px,17.5cqw)] lg:size-[76px]",
];

const CIRCLE_TONE: Record<ScaleTone, { idle: string; active: string }> = {
  brand: { idle: "border-brand-500 group-hover:bg-brand-50", active: "border-brand-500 bg-brand-500 ring-8 ring-brand-50" },
  neutral: { idle: "border-faint group-hover:bg-sand", active: "border-faint bg-faint ring-8 ring-sand" },
  teal: { idle: "border-teal group-hover:bg-teal-50", active: "border-teal bg-teal ring-8 ring-teal-50" },
};

// Плашка выбранного ответа: контраст текста ≥ 4.5 (brand-600/brand-50 6.2, muted/sand 5.6, teal/teal-50 4.56).
const PILL_TONE: Record<ScaleTone, string> = {
  brand: "bg-brand-50 text-brand-600",
  neutral: "bg-sand text-muted",
  teal: "bg-teal-50 text-teal",
};

// Подпись края под кругом: короткая форма — часть до « / » («Совершенно не про меня / полностью
// не согласен» → «Совершенно не про меня»). Полная подпись — в имени круга и в плашке.
function edgeLabel(label: string): string {
  return label.split(" / ")[0]!;
}

export function LikertScale({
  options,
  value,
  onPick,
  labelledBy,
  placeholder,
  disabled = false,
}: {
  options: { value: number; label: string }[];
  value: number | undefined;
  onPick: (value: number) => void;
  labelledBy: string;
  placeholder: string;
  disabled?: boolean; // короткая пауза автоперехода: второе нажатие не ответит на следующий вопрос
}) {
  const selectedIdx = options.findIndex((o) => o.value === value);
  const [focusIdx, setFocusIdx] = useState(selectedIdx >= 0 ? selectedIdx : 0);
  const [preview, setPreview] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(to: number) {
    const i = Math.max(0, Math.min(options.length - 1, to));
    setFocusIdx(i);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = refs.current.findIndex((el) => el === document.activeElement);
    if (current === -1) return;
    const map: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      Home: 0,
      End: options.length - 1,
    };
    if (e.key in map) {
      e.preventDefault();
      move(map[e.key]!);
    }
  }

  const shownIdx = selectedIdx >= 0 ? selectedIdx : preview;
  const shown = shownIdx !== null ? options[shownIdx] : undefined;
  const pillTone = selectedIdx >= 0 ? PILL_TONE[SCALE_TONES[selectedIdx] ?? "neutral"] : shown ? "border border-line bg-white text-ink" : "bg-sand/70 text-muted";

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        onKeyDown={onKeyDown}
        className="@container flex items-center justify-between"
      >
        {options.map((o, i) => {
          const tone = SCALE_TONES[i] ?? "neutral";
          const active = i === selectedIdx;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              tabIndex={i === focusIdx ? 0 : -1}
              onClick={() => onPick(o.value)}
              onFocus={() => {
                setFocusIdx(i);
                setPreview(i);
              }}
              onBlur={() => setPreview((p) => (p === i ? null : p))}
              onMouseEnter={() => setPreview(i)}
              onMouseLeave={() => setPreview((p) => (p === i ? null : p))}
              disabled={disabled}
              className="group flex min-h-[min(44px,19cqw)] min-w-[min(44px,19cqw)] items-center justify-center rounded-full outline-none"
            >
              <span
                aria-hidden
                className={
                  "block rounded-full border-[3px] transition-[background-color,box-shadow] duration-150 " +
                  "group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-4 group-focus-visible:outline-ink " +
                  CIRCLE_SIZE[i] +
                  " " +
                  (active ? CIRCLE_TONE[tone].active : "bg-white " + CIRCLE_TONE[tone].idle)
                }
              />
            </button>
          );
        })}
      </div>
      <div aria-hidden className="mt-2 flex items-start justify-between gap-6 text-sm font-bold leading-tight">
        <span className="max-w-[45%] text-brand-500">{edgeLabel(options[0]!.label)}</span>
        <span className="max-w-[45%] text-right text-teal">{edgeLabel(options[options.length - 1]!.label)}</span>
      </div>
      {/* Плашка: полная подпись выбранного (или наведённого/в фокусе) варианта. Для читалок не
          нужна — у каждого круга своё имя и состояние «выбран». */}
      <p
        aria-hidden
        data-scale-pill
        className={
          "mx-auto mt-5 flex min-h-12 w-full max-w-sm items-center justify-center rounded-2xl px-4 py-2 text-center font-bold leading-tight lg:max-w-xs " +
          pillTone
        }
      >
        {shown ? shown.label : placeholder}
      </p>
    </div>
  );
}
