"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LOCALES } from "@/i18n/config";
import { fmt, formatSum } from "@/i18n/format";
import { previewPromoAction, startPaymentAction, type CheckoutState } from "./actions";

type Level = "route" | "navigator";
type CheckoutDict = Dictionary["checkout"];

const idle: CheckoutState = { status: "idle" };

// Выбор уровня, промокод и кнопка оплаты. Цены приходят с сервера (из базы), скидка по промокоду
// проверяется на сервере и ещё раз — при оплате.
export function CheckoutForm({
  t,
  locale,
  levelOrder,
  recommended,
  recommendedWhy,
  prices,
  existing,
  testMode,
  paymentsAvailable,
  initialError,
  sumTemplate,
  needsGoal,
  directionOptions,
  legalLinks,
}: {
  t: CheckoutDict;
  locale: Locale;
  levelOrder: Level[];
  recommended: Level;
  recommendedWhy: string;
  prices: Partial<Record<Level, number>>;
  existing: Partial<Record<Level, string>>;
  testMode: boolean;
  paymentsAvailable: boolean;
  initialError: string | null;
  sumTemplate: string;
  // UX-18: без своей цели «Маршрут» требует выбрать цель перед оплатой — из направлений
  // бесплатного результата или свою.
  needsGoal: boolean;
  directionOptions: string[];
  legalLinks: { href: string; label: string }[];
}) {
  const available = levelOrder.filter((l) => prices[l] !== undefined && !existing[l]);
  const [level, setLevel] = useState<Level | null>(available.includes(recommended) ? recommended : (available[0] ?? null));
  // Язык отчёта — явный выбор до оплаты (UX-06): по умолчанию язык сайта, но можно сменить,
  // независимо от языка интерфейса. Сохраняется в заказе и не меняется при переключении сайта.
  const [reportLocale, setReportLocale] = useState<Locale>(locale);
  const [state, action, submitting] = useActionState(startPaymentAction, idle);

  // UX-18: направление из тизера или своя формулировка. Пусто, пока человек ничего не выбрал.
  const [goalChoice, setGoalChoice] = useState<string>("");
  const [customGoal, setCustomGoal] = useState("");
  const goalNeededNow = needsGoal && level === "route";
  const goal = goalChoice === "__custom__" ? customGoal.trim() : goalChoice;
  const goalMissing = goalNeededNow && !goal;

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percentOff: number; prices: Partial<Record<Level, number>> } | null>(
    null,
  );
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  const sum = (n: number) => formatSum(n, sumTemplate);
  const priceOf = (l: Level) => (promo ? promo.prices[l] : undefined) ?? prices[l];
  const amount = level ? priceOf(level) : undefined;
  const errorKey = state.status === "error" ? state.error : initialError;
  const errorText = errorKey ? (t.errors[errorKey as keyof CheckoutDict["errors"]] ?? t.errors.server) : null;
  const blocked = amount !== undefined && amount > 0 && !paymentsAvailable;

  function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoError(null);
    startChecking(async () => {
      const result = await previewPromoAction(code);
      if (result.ok) setPromo({ code, percentOff: result.percentOff, prices: result.prices });
      else setPromoError(t.errors[result.error] ?? t.errors.server);
    });
  }

  // Новый стиль (этап 3): на телефоне всё в одну колонку — пакеты, цель, язык, промокод, тёмный
  // блок итога и «что будет после оплаты»; на компьютере — две колонки, итог справа прилипает.
  return (
    <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <div className="space-y-5">
        <fieldset className="grid gap-4">
          <legend className="sr-only">{t.title}</legend>
          {levelOrder.map((l) => {
            const lt = t.levels[l];
            const isRecommended = l === recommended;
            const owned = existing[l];
            const selected = level === l;
            const base = prices[l];
            const current = priceOf(l);
            const price = base !== undefined && (
              <span className="shrink-0 text-right">
                <span className="block font-display text-xl font-extrabold tabular-nums leading-tight">
                  {current !== base && current !== undefined && (
                    <s className="mr-1.5 align-middle text-sm font-semibold text-muted">{sum(base)}</s>
                  )}
                  {sum(current ?? base)}
                </span>
                <span className="block text-xs text-muted">{t.oneTime}</span>
              </span>
            );
            if (owned) {
              // Уже купленный пакет — недоступен для выбора, вместо радиокнопки ссылка на отчёт.
              return (
                <div key={l} className="relative rounded-3xl border-2 border-teal-50 bg-teal-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-xl font-extrabold leading-tight">{lt.name}</p>
                      <p className="mt-0.5 text-sm text-muted">{lt.tagline}</p>
                    </div>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal text-white" aria-hidden>
                      <CheckMark className="size-4" />
                    </span>
                  </div>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-teal">
                    {t.alreadyHave}
                    <Link
                      href={`/report/${owned}`}
                      className="focus-ring inline-flex min-h-11 items-center rounded font-bold text-ink underline"
                    >
                      {t.openReport} →
                    </Link>
                  </p>
                </div>
              );
            }
            return (
              <label
                key={l}
                className={
                  "relative block cursor-pointer rounded-3xl border-2 bg-white transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/40 " +
                  (selected ? "border-brand-500 p-5" : "border-line px-5 py-4 hover:border-brand-500") +
                  (isRecommended ? " mt-3" : "")
                }
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-5 rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">
                    {t.recommended}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="level-choice"
                    value={l}
                    checked={selected}
                    onChange={() => setLevel(l)}
                    className="mt-1 size-5 shrink-0 accent-brand-500 focus:outline-none"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-display text-xl font-extrabold leading-tight">{lt.name}</span>
                        <span className="mt-0.5 block text-sm text-muted">{lt.tagline}</span>
                      </span>
                      {price}
                    </div>
                    {selected && (
                      <>
                        {isRecommended && <p className="mt-2 text-sm leading-relaxed text-brand-600">{recommendedWhy}</p>}
                        <ul className="mt-3 space-y-1.5 text-sm">
                          {lt.features.map((f) => (
                            <li key={f} className="flex gap-2">
                              <CheckMark className="mt-0.5 size-4 text-teal" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </fieldset>

        {/* Цель до оплаты «Маршрута» без своей цели (UX-18): направление из бесплатного результата
            или своя формулировка. Без этого «Маршрут» не оплачивается. Варианты — белые «таблетки»,
            сама радиокнопка скрыта визуально, фокус виден на таблетке. */}
        {goalNeededNow && (
          <div className="rounded-3xl bg-sun-100 p-5 text-sun-ink">
            <p className="font-display text-lg font-bold text-ink">{t.goalPicker.title}</p>
            <p className="mt-1 text-sm leading-relaxed">{t.goalPicker.text}</p>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label={t.goalPicker.title}>
              {[...directionOptions.map((d) => ({ value: d, label: d })), { value: "__custom__", label: t.goalPicker.custom }].map(
                (o) => (
                  <label
                    key={o.value}
                    className={
                      "flex min-h-12 cursor-pointer items-center rounded-full border-2 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/40 " +
                      (goalChoice === o.value ? "border-brand-500" : "border-white hover:border-brand-100")
                    }
                  >
                    <input
                      type="radio"
                      name="goal-choice"
                      className="sr-only"
                      checked={goalChoice === o.value}
                      onChange={() => setGoalChoice(o.value)}
                    />
                    {o.label}
                  </label>
                ),
              )}
            </div>
            {goalChoice === "__custom__" && (
              <input
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                maxLength={300}
                aria-label={t.goalPicker.custom}
                placeholder={t.goalPicker.customPlaceholder}
                className="focus-ring mt-2.5 min-h-12 w-full rounded-full border-2 border-brand-100 bg-white px-5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-500"
              />
            )}
          </div>
        )}

        {/* Язык отчёта (UX-06): явный выбор до оплаты, независимо от языка сайта. «Пилюля» из двух половин. */}
        {level && amount !== undefined && (
          <div>
            <p className="text-sm font-bold">{t.reportLanguageLabel}</p>
            <div className="mt-2 flex rounded-full bg-sand p-1">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setReportLocale(code)}
                  aria-pressed={reportLocale === code}
                  className={
                    "focus-ring min-h-11 flex-1 rounded-full px-3 text-sm font-bold transition-colors " +
                    (reportLocale === code ? "bg-ink text-on-dark" : "text-muted hover:text-ink")
                  }
                >
                  {t.reportLanguageNames[code]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{t.reportLanguageNote}</p>
          </div>
        )}

        {/* Промокод: ссылка, раскрывающая поле. */}
        {available.length > 0 && (
          <div>
            {promo ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-teal-50 px-5 py-3">
                <p className="flex items-center gap-2 font-semibold text-teal">
                  <CheckMark className="size-4" />
                  {fmt(t.promoApplied, { p: promo.percentOff })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                  className="focus-ring min-h-11 rounded text-sm font-semibold text-muted underline"
                >
                  {t.promoRemove}
                </button>
              </div>
            ) : promoOpen ? (
              <div>
                <label htmlFor="promo" className="text-sm font-bold">
                  {t.promoLabel}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="promo"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyPromo();
                      }
                    }}
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={64}
                    className="focus-ring min-h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-white px-5 font-mono uppercase outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={checking || !promoInput.trim()}
                    className="focus-ring min-h-12 shrink-0 rounded-full bg-ink px-5 font-bold text-on-dark disabled:opacity-50"
                  >
                    {checking ? "…" : t.promoApply}
                  </button>
                </div>
                {promoError && (
                  <p className="mt-2 text-sm font-medium text-danger" role="alert">
                    {promoError}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPromoOpen(true)}
                aria-expanded={false}
                className="focus-ring min-h-11 rounded font-bold text-brand-500 hover:text-brand-600"
              >
                {t.promoToggle}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Итог: тёмный блок с суммой и кнопкой, ниже — что будет после оплаты и рабочие ссылки на
          условия, возврат и конфиденциальность (ТЗ аудита §8). На компьютере колонка прилипает. */}
      {level && amount !== undefined && (
        <div className="mt-6 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          <form action={action} className="rounded-[28px] bg-ink p-5 text-on-dark sm:p-6">
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="promo" value={promo?.code ?? ""} />
            <input type="hidden" name="reportLocale" value={reportLocale} />
            <input type="hidden" name="goal" value={goal} />
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-on-dark-muted">{t.total}</span>
                <span className="block text-sm text-on-dark-muted">{t.levels[level].name}</span>
              </span>
              <span className="whitespace-nowrap font-display text-2xl font-extrabold tabular-nums">{sum(amount)}</span>
            </div>
            {(errorText || blocked || goalMissing) && (
              <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700" role="alert">
                {goalMissing ? t.goalPicker.required : blocked && !errorText ? t.errors.payments_unavailable : errorText}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || blocked || goalMissing}
              className="focus-ring-light mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-brand-500 px-6 text-lg font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? t.sending : amount === 0 ? t.getFree : fmt(t.pay, { sum: sum(amount) })}
            </button>
            {amount > 0 && (
              <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-on-dark-muted">
                {testMode && <p className="font-semibold text-sun">{t.testModeNote}</p>}
                <p className="flex gap-2">
                  <LockIcon />
                  <span>{t.cardNote}</span>
                </p>
              </div>
            )}
          </form>

          <div className="rounded-3xl border border-line bg-white p-5">
            <p className="font-bold">{t.afterPaymentTitle}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.afterPaymentText}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm">
              {legalLinks.map((l) => (
                <Link key={l.href} href={l.href} className="focus-ring rounded font-semibold text-brand-500 underline hover:text-brand-600">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={"shrink-0 " + className} aria-hidden focusable="false">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-3.5 shrink-0" aria-hidden focusable="false">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
