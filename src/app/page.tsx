import Link from "next/link";
import { FaqList, PricingPlans, Steps } from "@/components/blocks";
import { CtaButton, Section } from "@/components/ui";
import { getPricesSafe } from "@/lib/payments/prices";
import { getI18n } from "@/i18n/server";
import { VisitPing } from "./VisitPing";

// Лендинг (ТЗ 3.1.1). Все тексты — в src/i18n/dictionaries/uz.ts и ru.ts, раздел `landing`.
export default async function HomePage() {
  const { t } = await getI18n();
  const l = t.landing;

  return (
    <>
      <VisitPing />
      {/* Главный посыл */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-20">
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {l.hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{l.hero.subtitle}</p>
          <div className="mt-8">
            <CtaButton href="/start">{t.common.startFree}</CtaButton>
          </div>
          <p className="mt-4 text-sm text-muted">{l.hero.note}</p>
        </div>
      </section>

      {/* Как это работает */}
      <Section id="how" title={l.how.title}>
        <Steps t={t} />
        <Link href="/how-it-works" className="mt-4 inline-block py-2 font-semibold text-brand-600">
          {l.how.more} →
        </Link>
      </Section>

      {/* Пример отчёта */}
      <Section id="sample" title={l.sample.title}>
        <p className="-mt-3 mb-5 text-sm text-muted">{l.sample.subtitle}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-ink p-6 text-white">
            <p className="text-2xl font-extrabold">{l.sample.typeLabel}</p>
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
          <div className="rounded-2xl border border-slate-200 p-6">
            <p className="font-bold">{l.sample.lockedTitle}</p>
            <ul className="mt-3 space-y-2">
              {l.sample.locked.map((item, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <span aria-hidden>🔒</span>
                  <span className="text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Какие данные используем (UX-03: честно, без обещания «не собираем личные данные») */}
      <section className="mx-auto max-w-5xl px-4 pt-14">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="text-lg font-bold">{l.dataUse.title}</h2>
          <p className="mt-2 leading-relaxed text-muted">{l.dataUse.text}</p>
          <Link href="/privacy" className="mt-3 inline-block font-semibold text-brand-600">
            {l.dataUse.link} →
          </Link>
        </div>
      </section>

      {/* Цены */}
      <Section id="pricing" title={l.pricing.title}>
        <p className="-mt-3 mb-5 text-muted">{l.pricing.subtitle}</p>
        <PricingPlans t={t} prices={await getPricesSafe()} />
      </Section>

      {/* FAQ */}
      <Section id="faq" title={l.faq.title}>
        <FaqList t={t} />
        <Link href="/faq" className="mt-4 inline-block py-2 font-semibold text-brand-600">
          {l.faq.more} →
        </Link>
      </Section>

      {/* Финальный призыв */}
      <section className="mx-auto max-w-5xl px-4 pt-14">
        <div className="rounded-3xl bg-brand-500 px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{l.finalCta.title}</h2>
          <p className="mt-2 text-brand-100">{l.finalCta.text}</p>
          <Link
            href="/start"
            className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-white px-6 font-bold text-brand-600"
          >
            {t.common.startFree}
          </Link>
        </div>
      </section>
    </>
  );
}
