import Link from "next/link";
import type { ReactNode } from "react";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatSum } from "@/i18n/format";
import { titleFontSize } from "@/components/typeTitle";
import { MockBadge } from "./MockBadge";

// Страница бесплатного тизера (ТЗ 3.7.1, аудит §7): тип, портрет, ровно 3 сильные стороны,
// ровно 3 направления с пробной задачей, один бесплатный шаг, крючок-сюрприз под замком и
// компактный платный блок с описанием пакета из единого источника тарифов.
// Тексты от ИИ — на языке тизера (teaserLocale), всё остальное — на языке интерфейса.
// surprise_direction_internal сюда не передаётся и пользователю не показывается.

type TeaserDict = Dictionary["teaser"];

interface Props {
  t: TeaserDict;
  content: TeaserContent;
  teaserLocale: string;
  mock: boolean;
  // 16-тип под названием (решение (И)): код и название на языке интерфейса.
  sixteenType: string;
  // Описание пакета рекомендованного уровня — из PACKAGE_FEATURES, единого источника тарифов
  // (аудит §7: «убрать список закрытых разделов», показать состав пакета как на /pricing).
  features: string[];
  recommendedLevel: "route" | "navigator";
  // Цена и название рекомендуемого уровня — из единого источника тарифов (аудит §7);
  // null, если цена ещё не задана в базе (тогда компактный платный блок цену не показывает).
  recommendedPrice: number | null;
  sumTemplate: string;
  lowQuality: boolean;
  // Блок «портрет на другом языке» (решение (Л)); null — тизер на языке интерфейса.
  otherLanguage: ReactNode;
  // Куда ведёт «Открыть полный отчёт»: без аккаунта — на регистрацию (она появляется только перед оплатой).
  unlockHref: string;
  // Ссылка на уже оплаченный полный отчёт этой сессии (null — отчёта ещё нет).
  reportHref: string | null;
  footer: ReactNode;
}

export function TeaserView({
  t,
  content,
  teaserLocale,
  mock,
  sixteenType,
  features,
  recommendedLevel,
  recommendedPrice,
  sumTemplate,
  lowQuality,
  otherLanguage,
  unlockHref,
  reportHref,
  footer,
}: Props) {
  // top_strengths/fitting_directions — ровно 3 у новых тизеров (решение владельца, сентябрь 2026).
  // slice(0, 3) — защита для тизеров, сгенерированных до этого решения (у них могло быть 2–4).
  const strengths = content.top_strengths.slice(0, 3);
  const directions = content.fitting_directions.slice(0, 3);

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-5">
      {mock && <MockBadge label={t.mockBadge} note={t.mockNote} />}
      {otherLanguage}

      {/* Главная карточка: тип крупно — «вау-момент» и картинка для скриншота. */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-2xl shadow-brand-700/20 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-brand-700/40 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{t.yourType}</p>
          <h1
            lang={teaserLocale}
            className="mt-2 break-words font-black leading-[1.08] tracking-tight"
            style={{ fontSize: titleFontSize(content.personality_type_label) }}
          >
            {content.personality_type_label}
          </h1>
          <p lang={teaserLocale} className="mt-5 text-[1.05rem] leading-relaxed text-white/95">
            {content.portrait}
          </p>
        </div>
      </section>

      {/* 16-тип — вторичным блоком, с объяснением, откуда он взялся (аудит §7): не отдельный тест,
          а расчёт по ответам о личности. */}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="inline-flex rounded-xl bg-slate-100 px-2.5 py-1 font-semibold text-ink">{sixteenType}</span>
        <span>{t.sixteenTypeNote}</span>
      </p>

      {lowQuality && (
        <aside className="mt-5 rounded-3xl border border-sky-200 bg-sky-50 p-5">
          <p className="font-bold text-sky-900">💡 {t.lowQualityTitle}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-sky-900/90">{t.lowQualityText}</p>
          <Link href="/start?new=1" className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-600">
            {t.retakeCta} →
          </Link>
        </aside>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">{t.strengthsTitle}</h2>
        <ul className="mt-3 grid gap-2.5" lang={teaserLocale}>
          {strengths.map((s) => (
            <li key={s} className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3.5 font-semibold text-ink">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-brand-500 shadow-sm"
                aria-hidden
              >
                ✦
              </span>
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">{t.directionsTitle}</h2>
        <ol className="mt-3 grid gap-3" lang={teaserLocale}>
          {directions.map((d, i) => (
            <li key={d.title} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-black text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-bold leading-snug">{d.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{d.one_liner}</p>
                {/* trial_task необязателен — старый активный промпт (до нажатия «Создать версию
                    из текста в коде» в /admin/prompts) его у ИИ не просит. */}
                {d.trial_task && (
                  <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm leading-relaxed text-ink/90">
                    <span className="font-semibold text-brand-700">{t.trialTaskLabel}: </span>
                    {d.trial_task}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Один полезный бесплатный шаг (аудит §7, п.4): доступен уже сейчас, без оплаты.
          Необязательное поле — см. комментарий у trial_task выше. */}
      {content.free_step && (
        <section className="mt-8 rounded-[2rem] border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-950">
            <span aria-hidden>✅</span>
            {t.freeStepTitle}
          </h2>
          <p lang={teaserLocale} className="mt-2 leading-relaxed text-emerald-950/90">
            {content.free_step}
          </p>
        </section>
      )}

      {/* Крючок-сюрприз: направление названо только как факт, само оно — под замком. */}
      <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-ink p-6 text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-500/30 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
              <LockIcon className="size-5 text-amber-300" />
            </span>
            <h2 className="text-lg font-extrabold">{t.surpriseTitle}</h2>
          </div>
          <p lang={teaserLocale} className="mt-4 leading-relaxed text-white/90">
            {content.surprise_hook}
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-300">{t.surpriseLocked}</p>
        </div>
      </section>

      {/* Описание пакета вместо списка закрытых разделов (аудит §7): тот же состав, что на
          /pricing и на checkout, из единого источника тарифов (PACKAGE_FEATURES). */}
      <section className="mt-8 rounded-[2rem] border border-slate-200 p-5 sm:p-6">
        <h2 className="text-xl font-extrabold">{t.tocTitle}</h2>
        <ul className="mt-4 space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span className="mt-0.5 text-brand-500" aria-hidden>
                ✓
              </span>
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {reportHref && (
        <section className="mt-8 rounded-[2rem] border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
          <h2 className="text-xl font-extrabold text-emerald-950">✓ {t.haveReportTitle}</h2>
          <Link
            href={reportHref}
            className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-lg font-bold text-white shadow-lg shadow-emerald-600/25"
          >
            {t.haveReportCta} →
          </Link>
        </section>
      )}

      {/* Компактный платный блок (аудит §7, п.5): пакет и цена — из единого источника тарифов,
          разовая оплата, без подписки. */}
      <section className="mt-8 rounded-[2rem] bg-gradient-to-br from-brand-50 to-sun-50 p-6 text-center">
        <h2 className="text-2xl font-extrabold">{t.unlockTitle}</h2>
        <p className="mt-2 text-muted">{t.unlockText}</p>
        <p className="mt-4 text-sm">
          <span className="text-muted">{t.recommended}: </span>
          <b>{t.levels[recommendedLevel]}</b>
        </p>
        {recommendedPrice !== null && (
          <p className="mt-2 text-xl font-extrabold tabular-nums">
            {fmt(t.priceLine, { name: t.levels[recommendedLevel], sum: formatSum(recommendedPrice, sumTemplate) })}
          </p>
        )}
        <p className="mt-1 text-sm text-muted">{t.noSubscription}</p>
        <Link
          href={unlockHref}
          className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 px-6 text-lg font-bold text-white shadow-lg shadow-brand-500/30 transition-transform active:scale-[0.98]"
        >
          <LockIcon className="size-5" open />
          {t.unlockCta}
        </Link>
      </section>

      <p className="mt-5 text-center text-xs text-muted">{t.disclaimer}</p>

      {footer}
    </div>
  );
}

function LockIcon({ className, open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={className} aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d={open ? "M8 10.5V7.5a4 4 0 0 1 7.6-1.7" : "M8 10.5V7.5a4 4 0 0 1 8 0v3"} strokeLinecap="round" />
    </svg>
  );
}
