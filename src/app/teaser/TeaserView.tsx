import Link from "next/link";
import type { ReactNode } from "react";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { TocItem } from "@/lib/teaser/toc";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { titleFontSize } from "@/components/typeTitle";
import { MockBadge } from "./MockBadge";

// Страница бесплатного тизера (ТЗ 3.7.1): тип, портрет, сильные стороны, 2–3 направления,
// крючок-сюрприз под замком и заблокированное оглавление полного отчёта.
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
  toc: TocItem[];
  recommendedLevel: "route" | "navigator";
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
  toc,
  recommendedLevel,
  lowQuality,
  otherLanguage,
  unlockHref,
  reportHref,
  footer,
}: Props) {
  const strengths = content.top_strengths.slice(0, 3);
  const directions = content.fitting_directions.slice(0, 3);

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-5">
      {mock && <MockBadge label={t.mockBadge} note={t.mockNote} />}
      {otherLanguage}

      {/* Главная карточка: тип крупно — «вау-момент» и картинка для скриншота. */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-indigo-600 to-fuchsia-600 p-6 text-white shadow-2xl shadow-indigo-500/30 sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-fuchsia-400/30 blur-3xl"
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
          <p className="mt-3 inline-flex rounded-2xl bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur">
            {sixteenType}
          </p>
          <p lang={teaserLocale} className="mt-5 text-[1.05rem] leading-relaxed text-white/95">
            {content.portrait}
          </p>
        </div>
      </section>

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
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 font-black text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-bold leading-snug">{d.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{d.one_liner}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Крючок-сюрприз: направление названо только как факт, само оно — под замком. */}
      <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-ink p-6 text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-fuchsia-500/30 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
              <LockIcon className="size-5 text-amber-300" />
            </span>
            <h2 className="text-lg font-extrabold">{t.surpriseTitle}</h2>
          </div>
          <p className="mt-4 select-none text-2xl font-black tracking-tight text-white/80 blur-[7px]" aria-hidden>
            ██████ ████████
          </p>
          <p lang={teaserLocale} className="mt-3 leading-relaxed text-white/90">
            {content.surprise_hook}
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-300">{t.surpriseLocked}</p>
        </div>
      </section>

      {/* Заблокированное оглавление полного отчёта: 20+ пунктов с замками (решение (Г)). */}
      <section className="mt-8 rounded-[2rem] border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-xl font-extrabold">{t.tocTitle}</h2>
          <p className="text-sm font-semibold text-brand-600">{fmt(t.tocCount, { n: toc.length })}</p>
        </div>
        <ol className="mt-4 divide-y divide-slate-100">
          {toc.map((item, i) => (
            <li
              key={item.text}
              lang={item.kind === "personal" ? teaserLocale : undefined}
              className="flex items-center gap-3 py-2.5"
            >
              <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-slate-400">{i + 1}</span>
              <span className={"flex-1 leading-snug " + (item.kind === "personal" ? "font-semibold" : "text-ink/80")}>
                {item.text}
              </span>
              <LockIcon className="size-4 shrink-0 text-slate-400" />
            </li>
          ))}
        </ol>
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

      {/* Призыв открыть полный отчёт. Уровень, подходящий по развилке, — рекомендуемый (решение (В)). */}
      <section className="mt-8 rounded-[2rem] bg-gradient-to-br from-brand-50 to-fuchsia-50 p-6 text-center">
        <h2 className="text-2xl font-extrabold">{t.unlockTitle}</h2>
        <p className="mt-2 text-muted">{t.unlockText}</p>
        <p className="mt-4 text-sm">
          <span className="text-muted">{t.recommended}: </span>
          <b>{t.levels[recommendedLevel]}</b>
        </p>
        <Link
          href={unlockHref}
          className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 text-lg font-bold text-white shadow-lg shadow-brand-500/30 transition-transform active:scale-[0.98]"
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
