import { formatSum } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";

// Общие блоки: используются и на лендинге, и на отдельных страницах.

export function Steps({ t }: { t: Dictionary }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {t.landing.how.steps.map((step, i) => (
        <li key={i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-600">
            {i + 1}
          </span>
          <h3 className="mt-3 font-bold">{step.title}</h3>
          <p className="mt-1 text-sm text-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

// «Кому подходит» (ТЗ аудита §5, блок 4): три сценария использования, без процентов и отзывов.
export function AudienceCards({ t }: { t: Dictionary }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {t.landing.audience.items.map((item, i) => (
        <li key={i} className="rounded-2xl border border-line bg-white p-5">
          <h3 className="font-bold">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

// Цены платных уровней берутся из базы (prices); если база недоступна — из словаря.
// Порядок карточек в словаре: бесплатно, «Маршрут», «Навигатор».
const PLAN_LEVELS = [null, "route", "navigator"] as const;

export function PricingPlans({ t, prices }: { t: Dictionary; prices: Partial<Record<"route" | "navigator", number>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {t.landing.pricing.plans.map((plan, i) => (
        <div
          key={i}
          className={
            "flex flex-col rounded-2xl border p-5 " +
            (i === 0 ? "border-line bg-white" : "border-brand-100 bg-brand-50")
          }
        >
          <h3 className="text-lg font-bold">{plan.name}</h3>
          <p className="mt-2 text-2xl font-extrabold">
            {(() => {
              const level = PLAN_LEVELS[i];
              const amount = level ? prices[level] : undefined;
              return amount !== undefined ? formatSum(amount, t.common.sum) : plan.price;
            })()}
            {i > 0 && <span className="ml-2 text-sm font-medium text-muted">{t.landing.pricing.oneTime}</span>}
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {plan.features.map((f, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="text-brand-500">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function FaqList({ t }: { t: Dictionary }) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
      {t.landing.faq.items.map((item, i) => (
        <details key={i} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {item.q}
            <span aria-hidden className="text-xl text-brand-500 transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
