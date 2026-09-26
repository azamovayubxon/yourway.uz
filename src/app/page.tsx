import Link from "next/link";
import { AudienceCards, FaqList, PricingPlans, Steps } from "@/components/blocks";
import { CtaButton, Section } from "@/components/ui";
import { getPricesSafe } from "@/lib/payments/prices";
import { getI18n } from "@/i18n/server";
import { VisitPing } from "./VisitPing";

// Лендинг: 7 блоков (ТЗ аудита §5). Все тексты — в src/i18n/dictionaries/uz.ts и ru.ts, раздел `landing`.
export default async function HomePage() {
  const { t } = await getI18n();
  const l = t.landing;

  return (
    <>
      <VisitPing />
      {/* 1. Польза и начало бесплатного теста */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-20">
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {l.hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{l.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton href="/start">{t.common.startFree}</CtaButton>
            <a href="#sample" className="focus-ring rounded py-2 font-semibold text-brand-600 hover:text-brand-700">
              {l.hero.ctaSample} →
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">{l.hero.note}</p>
        </div>
      </section>

      {/* 2. Демонстрация результата: явная метка «Пример», без процентов и выдуманных отзывов */}
      <Section id="sample" title={l.sample.title}>
        <p className="-mt-3 mb-5 text-sm text-muted">{l.sample.subtitle}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-ink p-6 text-white">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              {l.sample.badge}
            </span>
            <p className="mt-4 text-2xl font-extrabold">{l.sample.typeLabel}</p>
            <p className="mt-1 text-sm text-slate-300">{l.sample.typeCode}</p>
            <p className="mt-4 leading-relaxed text-slate-100">{l.sample.portrait}</p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {l.sample.strengthsTitle}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {l.sample.strengths.map((s, i) => (
                <li key={i} className="rounded-full bg-white/10 px-3 py-1 text-sm">{s}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {l.sample.directionsTitle}
            </p>
            <ul className="mt-2 space-y-1">
              {l.sample.directions.map((d, i) => (
                <li key={i}>→ {d}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="font-bold">{l.sample.lockedTitle}</p>
              <ul className="mt-3 space-y-2">
                {l.sample.locked.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-app-bg px-4 py-3 text-sm">
                    <span aria-hidden>🔒</span>
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Демо и платной пользы: короткий пример маршрута с этапами, явно подписан как пример. */}
            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 p-6">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-600">
                {l.sample.routeExample.badge}
              </span>
              <p className="mt-3 font-bold">{l.sample.routeExample.title}</p>
              <ol className="mt-3 space-y-2 text-sm">
                {l.sample.routeExample.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600">
                      {i + 1}
                    </span>
                    <span className="text-muted">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Section>

      {/* 3. Три шага: ответы → результат → при желании полный план */}
      <Section id="how" title={l.how.title}>
        <Steps t={t} />
      </Section>

      {/* 4. Кому подходит */}
      <Section title={l.audience.title}>
        <AudienceCards t={t} />
      </Section>

      {/* 5. Короткое сравнение бесплатного и платного */}
      <Section id="pricing" title={l.pricing.title}>
        <p className="-mt-3 mb-5 text-muted">{l.pricing.subtitle}</p>
        <PricingPlans t={t} prices={await getPricesSafe()} />
        <Link href="/pricing" className="mt-4 inline-block py-2 font-semibold text-brand-600">
          {t.footer.pricing} →
        </Link>
      </Section>

      {/* 6. Как формируется результат и как используются данные (UX-03) */}
      <section className="mx-auto max-w-5xl px-4 pt-14">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{l.methodology.title}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="font-bold">{l.methodology.resultTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted">{l.methodology.resultText}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="font-bold">{l.methodology.dataTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted">{l.methodology.dataText}</p>
            <Link href="/privacy" className="mt-3 inline-block font-semibold text-brand-600">
              {l.methodology.link} →
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FAQ и финальный призыв */}
      <Section id="faq" title={l.faq.title}>
        <FaqList t={t} />
        <Link href="/faq" className="mt-4 inline-block py-2 font-semibold text-brand-600">
          {l.faq.more} →
        </Link>
      </Section>

      <section className="mx-auto max-w-5xl px-4 pt-14">
        <div className="rounded-3xl bg-brand-500 px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{l.finalCta.title}</h2>
          <p className="mt-2 text-brand-100">{l.finalCta.text}</p>
          <Link
            href="/start"
            className="focus-ring mt-6 inline-flex min-h-12 items-center rounded-2xl bg-white px-6 font-bold text-brand-600"
          >
            {t.common.startFree}
          </Link>
        </div>
      </section>
    </>
  );
}
