import Link from "next/link";
import { FaqList, PricingPlans } from "@/components/blocks";
import { telegramUrl } from "@/components/Footer";
import { DirectionsGrid } from "@/components/landing/DirectionsGrid";
import { HeroIllustration } from "@/components/landing/HeroIllustration";
import { LandingIcon } from "@/components/landing/icons";
import { CtaButton, Section } from "@/components/ui";
import { fmt, formatSum } from "@/i18n/format";
import { getPricesSafe } from "@/lib/payments/prices";
import { getI18n } from "@/i18n/server";
import { VisitPing } from "./VisitPing";

// Главная платформы (этап «Новый стиль, часть 1», сентябрь 2026). Порядок блоков: первый экран →
// миссия → направления (работает «Путь профессии», остальные — «Скоро») → как это работает →
// пример результата, цены, какие данные используем, FAQ (их требует аудит: UX-02, UX-03, UX-05) → финал.
// Все тексты — в src/i18n/dictionaries/uz.ts и ru.ts, раздел `landing`. Цены — из базы.
export default async function HomePage() {
  const { t } = await getI18n();
  const l = t.landing;
  const prices = await getPricesSafe();
  const tg = telegramUrl(t);

  // Цены в большой карточке «Путь профессии»: из базы, если база недоступна — из словаря (как в PricingPlans).
  const priceText = (level: "route" | "navigator", fallback: string) => {
    const amount = prices[level];
    return amount !== undefined ? formatSum(amount, t.common.sum) : fallback;
  };
  const mainLines: [string, string, string] = [
    l.directions.main.free,
    fmt(l.directions.main.route, { price: priceText("route", l.pricing.plans[1].price) }),
    fmt(l.directions.main.navigator, { price: priceText("navigator", l.pricing.plans[2].price) }),
  ];

  return (
    <>
      <VisitPing />

      {/* 1. Первый экран: слева текст, справа иллюстрация (на телефоне — под текстом) */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">
            <span aria-hidden className="size-1.5 rounded-full bg-teal" />
            {l.hero.badge}
          </span>
          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[52px]">
            {l.hero.titleStart}
            <span className="text-brand-500">{l.hero.titleAccent}</span>
            {l.hero.titleEnd}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{l.hero.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CtaButton href="/start" className="w-full sm:w-auto">
              {t.common.startFree}
            </CtaButton>
            <a
              href="#directions"
              className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-white px-7 font-bold text-ink transition-colors hover:border-ink sm:w-auto"
            >
              {l.hero.ctaDirections}
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">{l.hero.note}</p>
        </div>
        <HeroIllustration you={l.hero.illustration.you} labels={l.hero.illustration.labels} />
      </section>

      {/* 2. Миссия: тёмный блок */}
      <section id="mission" className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
        <div className="rounded-[28px] bg-ink px-5 py-8 text-on-dark sm:p-10 lg:p-14">
          <p className="text-xs font-bold tracking-[0.16em] text-sun">{l.mission.label}</p>
          <h2 className="mt-4 max-w-3xl text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
            {l.mission.titleStart} <span className="text-sun">{l.mission.titleAccent}</span>
          </h2>
          <div className="mt-8 grid gap-5 leading-relaxed text-on-dark-muted lg:grid-cols-2 lg:gap-10">
            <p>{l.mission.p1}</p>
            <p>{l.mission.p2}</p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {l.mission.cards.map((card, i) => (
              <li key={i} className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                <span
                  className={
                    "flex size-11 shrink-0 items-center justify-center rounded-2xl text-white " +
                    (i === 0 ? "bg-teal" : "bg-brand-500")
                  }
                >
                  <LandingIcon name={i === 0 ? "person" : "globe"} />
                </span>
                <div>
                  <h3 className="font-bold text-on-dark">{card.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-on-dark-muted">{card.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. Направления: «Путь профессии» + карточки «Скоро» (счётчик интереса soon:<id>) */}
      <section id="directions" className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-teal">{l.directions.label}</p>
            <h2 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl">
              {l.directions.title}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">{l.directions.subtitle}</p>
        </div>
        <DirectionsGrid d={l.directions} mainLines={mainLines} telegramUrl={tg} />
        <div className="mt-4 flex flex-col gap-4 rounded-3xl bg-sand p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-3">
            <LandingIcon name="send" className="mt-0.5 size-5 text-teal" />
            <p className="text-sm leading-relaxed text-ink">
              <b>{l.directions.subscribe.lead}</b> {l.directions.subscribe.text}
            </p>
          </div>
          <a
            href={tg}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-ink px-6 text-sm font-bold text-on-dark transition-colors hover:bg-brand-700"
          >
            {l.directions.subscribe.button}
          </a>
        </div>
      </section>

      {/* 4. Как это работает: портрет растёт вместе с вами */}
      <section id="how" className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
        <h2 className="max-w-2xl text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl">{l.grow.title}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">{l.grow.subtitle}</p>
        <ol className="mt-8 grid gap-3 sm:gap-4 md:grid-cols-3">
          {l.grow.steps.map((step, i) => (
            <li key={i} className="rounded-3xl border border-line bg-white p-6">
              <span
                className={
                  "flex size-10 items-center justify-center rounded-2xl font-display text-lg font-extrabold " +
                  ["bg-brand-500 text-white", "bg-teal text-white", "bg-sun text-ink"][i]
                }
              >
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. Пример результата (UX-02): явная метка «Пример», данные вымышленные */}
      <Section id="sample" title={l.sample.title}>
        <p className="-mt-3 mb-5 text-sm text-muted">{l.sample.subtitle}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] bg-ink p-6 text-on-dark sm:p-8">
            <span className="inline-flex rounded-full bg-sun px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink">
              {l.sample.badge}
            </span>
            <p className="mt-4 font-display text-2xl font-extrabold">{l.sample.typeLabel}</p>
            <p className="mt-1 text-sm text-on-dark-muted">{l.sample.typeCode}</p>
            <p className="mt-4 leading-relaxed text-on-dark">{l.sample.portrait}</p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-on-dark-muted">
              {l.sample.strengthsTitle}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {l.sample.strengths.map((s, i) => (
                <li key={i} className="rounded-full bg-white/10 px-3 py-1 text-sm">{s}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-on-dark-muted">
              {l.sample.directionsTitle}
            </p>
            <ul className="mt-2 space-y-1">
              {l.sample.directions.map((d, i) => (
                <li key={i}>→ {d}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[28px] border border-line bg-white p-6">
              <p className="font-bold">{l.sample.lockedTitle}</p>
              <ul className="mt-3 space-y-2">
                {l.sample.locked.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl bg-app-bg px-4 py-3 text-sm">
                    <span aria-hidden>🔒</span>
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Демо и платной пользы: короткий пример маршрута с этапами, явно подписан как пример. */}
            <div className="rounded-[28px] border border-dashed border-brand-100 bg-brand-50 p-6">
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

      {/* 6. Бесплатно и платно (UX-05): цены из базы */}
      <Section id="pricing" title={l.pricing.title}>
        <p className="-mt-3 mb-5 text-muted">{l.pricing.subtitle}</p>
        <PricingPlans t={t} prices={prices} />
        <Link href="/pricing" className="focus-ring mt-4 inline-block rounded py-2 font-semibold text-brand-600 hover:text-brand-700">
          {t.footer.pricing} →
        </Link>
      </Section>

      {/* 7. Как формируется результат и как используются данные (UX-03) */}
      <Section title={l.methodology.title}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-6">
            <h3 className="font-bold">{l.methodology.resultTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted">{l.methodology.resultText}</p>
          </div>
          <div className="rounded-3xl border border-line bg-white p-6">
            <h3 className="font-bold">{l.methodology.dataTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted">{l.methodology.dataText}</p>
            <Link href="/privacy" className="focus-ring mt-3 inline-block rounded font-semibold text-brand-600 hover:text-brand-700">
              {l.methodology.link} →
            </Link>
          </div>
        </div>
      </Section>

      {/* 8. FAQ */}
      <Section id="faq" title={l.faq.title}>
        <FaqList t={t} />
        <Link href="/faq" className="focus-ring mt-4 inline-block rounded py-2 font-semibold text-brand-600 hover:text-brand-700">
          {l.faq.more} →
        </Link>
      </Section>

      {/* 9. Финал: терракотовый блок */}
      <section className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20">
        <div className="flex flex-col gap-6 rounded-[28px] bg-brand-500 px-6 py-10 text-white sm:px-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl">{l.finalCta.title}</h2>
            <p className="mt-2 text-white">{l.finalCta.text}</p>
          </div>
          <Link
            href="/start"
            className="focus-ring-light inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-white px-7 font-bold text-brand-600 transition-colors hover:bg-brand-50 md:w-auto"
          >
            {l.finalCta.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
