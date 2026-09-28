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

  return (
    <div className="mt-6 space-y-6 pb-28 sm:pb-0">
      <fieldset className="grid gap-4">
        <legend className="sr-only">{t.title}</legend>
        {levelOrder.map((l) => {
          const lt = t.levels[l];
          const isRecommended = l === recommended;
          const owned = existing[l];
          const selected = level === l;
          const base = prices[l];
          const current = priceOf(l);
          return (
            <label
              key={l}
              className={
                "relative block rounded-3xl border-2 p-5 transition-colors " +
                (owned
                  ? "border-emerald-200 bg-emerald-50/60"
                  : selected
                    ? "cursor-pointer border-brand-500 bg-brand-50/60 shadow-lg shadow-brand-500/10"
                    : "cursor-pointer border-slate-200 bg-white hover:border-slate-300")
              }
            >
              {isRecommended && (
                <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-3 py-1 text-xs font-bold text-white shadow">
                  ★ {t.recommended}
                </span>
              )}
              <div className="flex items-start gap-3">
                {!owned && (
                  <input
                    type="radio"
                    name="level-choice"
                    value={l}
                    checked={selected}
                    onChange={() => setLevel(l)}
                    className="mt-1.5 size-5 shrink-0 accent-brand-500"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-xl font-extrabold">{lt.name}</span>
                    {base !== undefined && (
                      <span className="text-right">
                        {current !== base && current !== undefined && (
                          <s className="mr-2 text-sm text-muted">{sum(base)}</s>
                        )}
                        <span className="text-xl font-extrabold tabular-nums">{sum(current ?? base)}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-muted">
                    {lt.tagline} · {t.oneTime}
                  </p>
                  {isRecommended && <p className="mt-2 text-sm text-brand-700">{recommendedWhy}</p>}
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {lt.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden className="text-brand-500">
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {owned && (
                    <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-emerald-800">
                      ✓ {t.alreadyHave}
                      <Link href={`/report/${owned}`} className="inline-flex min-h-11 items-center text-brand-600 underline">
                        {t.openReport} →
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      {/* Цель до оплаты «Маршрута» без своей цели (UX-18): направление из бесплатного результата
          или своя формулировка. Без этого «Маршрут» не оплачивается. */}
      {goalNeededNow && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
          <p className="font-semibold text-amber-950">{t.goalPicker.title}</p>
          <p className="mt-1 text-sm text-amber-950/80">{t.goalPicker.text}</p>
          <div className="mt-3 grid gap-2" role="radiogroup" aria-label={t.goalPicker.title}>
            {directionOptions.map((d) => (
              <label
                key={d}
                className={
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold transition-colors " +
                  (goalChoice === d ? "border-brand-500 bg-white" : "border-transparent bg-white/70 hover:border-slate-200")
                }
              >
                <input
                  type="radio"
                  name="goal-choice"
                  className="size-4 accent-brand-500"
                  checked={goalChoice === d}
                  onChange={() => setGoalChoice(d)}
                />
                {d}
              </label>
            ))}
            <label
              className={
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold transition-colors " +
                (goalChoice === "__custom__" ? "border-brand-500 bg-white" : "border-transparent bg-white/70 hover:border-slate-200")
              }
            >
              <input
                type="radio"
                name="goal-choice"
                className="size-4 accent-brand-500"
                checked={goalChoice === "__custom__"}
                onChange={() => setGoalChoice("__custom__")}
              />
              {t.goalPicker.custom}
            </label>
          </div>
          {goalChoice === "__custom__" && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              maxLength={300}
              placeholder={t.goalPicker.customPlaceholder}
              className="mt-2.5 min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-brand-500"
            />
          )}
        </div>
      )}

      {/* Промокод */}
      {available.length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-4">
          {promo ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-emerald-800">✓ {fmt(t.promoApplied, { p: promo.percentOff })}</p>
              <button
                type="button"
                onClick={() => {
                  setPromo(null);
                  setPromoInput("");
                }}
                className="min-h-11 text-sm font-semibold text-muted underline"
              >
                {t.promoRemove}
              </button>
            </div>
          ) : promoOpen ? (
            <div>
              <label htmlFor="promo" className="text-sm font-semibold">
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
                  className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 font-mono uppercase outline-none focus:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/30"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={checking || !promoInput.trim()}
                  className="min-h-12 shrink-0 rounded-2xl bg-ink px-4 font-bold text-white disabled:opacity-50"
                >
                  {checking ? "…" : t.promoApply}
                </button>
              </div>
              {promoError && (
                <p className="mt-2 text-sm font-medium text-rose-700" role="alert">
                  {promoError}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPromoOpen(true)}
              className="min-h-11 font-semibold text-brand-600"
            >
              {t.promoToggle}
            </button>
          )}
        </div>
      )}

      {/* Язык отчёта (UX-06): явный выбор до оплаты, независимо от языка сайта. */}
      {level && amount !== undefined && (
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">{t.reportLanguageLabel}</p>
          <div className="mt-2 flex gap-2">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setReportLocale(code)}
                aria-pressed={reportLocale === code}
                className={
                  "min-h-11 flex-1 rounded-xl border-2 px-3 text-sm font-semibold transition-colors " +
                  (reportLocale === code
                    ? "border-brand-500 bg-white text-brand-600"
                    : "border-transparent bg-white/60 text-muted hover:text-ink")
                }
              >
                {t.reportLanguageNames[code]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.reportLanguageNote}</p>
        </div>
      )}

      {/* Что происходит после оплаты + рабочие ссылки на условия, возврат и конфиденциальность
          (ТЗ аудита §8) — видны до оплаты, в обычном потоке страницы (не в закреплённой панели). */}
      {level && amount !== undefined && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold">{t.afterPaymentTitle}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.afterPaymentText}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-sm">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="font-semibold text-brand-600 underline">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Оплата: на телефоне итог и кнопка закреплены внизу с учётом safe-area (ТЗ аудита §8),
          на компьютере — обычным блоком в потоке страницы. */}
      {level && amount !== undefined && (
        <form
          action={action}
          className="fixed inset-x-0 bottom-0 z-20 space-y-3 border-t border-slate-200 bg-white/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:space-y-3 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4 sm:shadow-none sm:backdrop-blur-none"
        >
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="promo" value={promo?.code ?? ""} />
          <input type="hidden" name="reportLocale" value={reportLocale} />
          <input type="hidden" name="goal" value={goal} />
          <div className="mx-auto flex max-w-xl items-baseline justify-between gap-3 border-t border-slate-100 pt-3 sm:pt-4">
            <span className="text-muted">
              {t.total} · {t.levels[level].name}
            </span>
            <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums">{sum(amount)}</span>
          </div>
          <div className="mx-auto max-w-xl space-y-3">
            {(errorText || blocked || goalMissing) && (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
                {goalMissing ? t.goalPicker.required : blocked && !errorText ? t.errors.payments_unavailable : errorText}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || blocked || goalMissing}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-6 text-lg font-bold text-white shadow-lg shadow-brand-500/30 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? t.sending : amount === 0 ? t.getFree : fmt(t.pay, { sum: sum(amount) })}
            </button>
            {amount > 0 && (
              <p className="text-center text-xs leading-relaxed text-muted">
                {testMode && <span className="block font-semibold text-amber-700">{t.testModeNote}</span>}
                🔒 {t.cardNote}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
