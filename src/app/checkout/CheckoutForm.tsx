"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatSum } from "@/i18n/format";
import { previewPromoAction, startPaymentAction, type CheckoutState } from "./actions";

type Level = "route" | "navigator";
type CheckoutDict = Dictionary["checkout"];

const idle: CheckoutState = { status: "idle" };

// Выбор уровня, промокод и кнопка оплаты. Цены приходят с сервера (из базы), скидка по промокоду
// проверяется на сервере и ещё раз — при оплате.
export function CheckoutForm({
  t,
  levelOrder,
  recommended,
  recommendedWhy,
  prices,
  existing,
  testMode,
  paymentsAvailable,
  initialError,
  sumTemplate,
}: {
  t: CheckoutDict;
  levelOrder: Level[];
  recommended: Level;
  recommendedWhy: string;
  prices: Partial<Record<Level, number>>;
  existing: Partial<Record<Level, string>>;
  testMode: boolean;
  paymentsAvailable: boolean;
  initialError: string | null;
  sumTemplate: string;
}) {
  const available = levelOrder.filter((l) => prices[l] !== undefined && !existing[l]);
  const [level, setLevel] = useState<Level | null>(available.includes(recommended) ? recommended : (available[0] ?? null));
  const [state, action, submitting] = useActionState(startPaymentAction, idle);

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
    <div className="mt-6 space-y-6">
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
                <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-brand-500 to-indigo-600 px-3 py-1 text-xs font-bold text-white shadow">
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

      {/* Оплата */}
      {level && amount !== undefined && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="promo" value={promo?.code ?? ""} />
          <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-muted">
              {t.total} · {t.levels[level].name}
            </span>
            <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums">{sum(amount)}</span>
          </div>
          {(errorText || blocked) && (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
              {blocked && !errorText ? t.errors.payments_unavailable : errorText}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || blocked}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 text-lg font-bold text-white shadow-lg shadow-brand-500/30 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? t.sending : amount === 0 ? t.getFree : fmt(t.pay, { sum: sum(amount) })}
          </button>
          {amount > 0 && (
            <p className="text-center text-xs leading-relaxed text-muted">
              {testMode && <span className="block font-semibold text-amber-700">{t.testModeNote}</span>}
              🔒 {t.cardNote}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
