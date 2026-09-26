import Link from "next/link";
import type { ReactNode } from "react";
import { MockBadge } from "@/app/teaser/MockBadge";
import { titleFontSize } from "@/components/typeTitle";
import type { ReportContent, ReportRoute } from "@/lib/ai/report-schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { ActNowChecklist, SectionNav } from "./ReportClient";

// Полный отчёт онлайн (ТЗ 3.10.1, Приложение Б §7) — то, за что человек заплатил. Сделан для чтения
// с телефона: крупный текст, короткие блоки, липкое оглавление, маршруты раскрываются по нажатию,
// первые шаги — чек-листом. Тексты от ИИ — на языке отчёта (reportLocale), всё остальное —
// на языке интерфейса.

type ReportDict = Dictionary["report"];

interface Props {
  id: string;
  t: ReportDict;
  content: ReportContent;
  reportLocale: string;
  levelName: string;
  sixteenType: string;
  learningStyles: string[];
  date: string;
  mockBadge: { label: string; note: string } | null;
  otherLanguage: string | null;
  footer: ReactNode;
}

const SECTION_ICONS = {
  portrait: "🪞",
  goal: "🎯",
  reality: "⚖️",
  path: "🗺️",
  learning: "📚",
  future: "🤖",
  alternatives: "✨",
  actNow: "✅",
} as const;
type SectionId = keyof typeof SECTION_ICONS;

const ROUTE_ICONS: Record<ReportRoute["type"], string> = { local_cheap: "📍", abroad: "✈️", online: "💻" };

const VERDICT_STYLES = {
  fits: { icon: "✅", box: "bg-emerald-50 text-emerald-900", pill: "bg-emerald-600" },
  ambitious: { icon: "🚀", box: "bg-amber-50 text-amber-950", pill: "bg-amber-500" },
  mismatch: { icon: "🧭", box: "bg-violet-50 text-violet-950", pill: "bg-violet-600" },
} as const;

export function ReportView({
  id,
  t,
  content,
  reportLocale,
  levelName,
  sixteenType,
  learningStyles,
  date,
  mockBadge,
  otherLanguage,
  footer,
}: Props) {
  const { portrait, goal, reality_check: reality, main_path: path, alternatives, act_now: actNow } = content;
  const lang = reportLocale;
  const order: SectionId[] = ["portrait", "goal", "reality", "path", "learning", "future", "alternatives", "actNow"];
  const nav = order.map((s) => ({ id: s, title: t.sections[s] }));
  const number = (s: SectionId) => String(order.indexOf(s) + 1).padStart(2, "0");
  const verdict = VERDICT_STYLES[reality.verdict];

  return (
    <article className="mx-auto max-w-2xl px-4 pb-14 pt-5">
      {mockBadge && <MockBadge label={mockBadge.label} note={mockBadge.note} />}
      {otherLanguage && <p className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-muted">{otherLanguage}</p>}

      {/* Обложка: тип крупно, уровень и дата. */}
      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-indigo-600 to-fuchsia-600 p-6 text-white shadow-2xl shadow-indigo-500/30 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-fuchsia-400/30 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{fmt(t.kicker, { level: levelName })}</p>
          <h1
            lang={lang}
            className="mt-3 break-words font-black leading-[1.08] tracking-tight"
            style={{ fontSize: titleFontSize(portrait.type_label) }}
          >
            {portrait.type_label}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
            <span className="rounded-2xl bg-white/15 px-3 py-1 backdrop-blur">{sixteenType}</span>
            <span className="rounded-2xl bg-white/15 px-3 py-1 backdrop-blur">{fmt(t.createdAt, { date })}</span>
          </div>
          <p lang={lang} className="mt-5 text-[1.05rem] font-medium leading-relaxed text-white/95">
            {goal.statement}
          </p>
        </div>
      </header>

      <SectionNav items={nav} label={t.toc} />

      <Section id="portrait" n={number("portrait")} title={t.sections.portrait}>
        <Prose lang={lang} lead>
          {portrait.summary}
        </Prose>
        <h3 className="mt-6 font-bold">{t.strengths}</h3>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" lang={lang}>
          {portrait.strengths.map((s) => (
            <li key={s} className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3.5 font-semibold leading-snug">
              <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 shadow-sm" aria-hidden>
                ✦
              </span>
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <h3 className="font-bold text-amber-950">💡 {t.watchouts}</h3>
          <ul className="mt-2 space-y-2 text-[0.98rem] leading-relaxed text-amber-950/90" lang={lang}>
            {portrait.watchouts.map((w) => (
              <li key={w} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="goal" n={number("goal")} title={t.sections.goal}>
        <figure className="rounded-3xl border-2 border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
          <figcaption className="text-xs font-bold uppercase tracking-widest text-brand-600">
            {goal.source === "stated" ? t.goalStated : t.goalConstructed}
          </figcaption>
          <blockquote lang={lang} className="mt-2 text-lg font-bold leading-snug">
            {goal.statement}
          </blockquote>
        </figure>
        {goal.constructed_options.length > 0 && (
          <>
            <h3 className="mt-6 font-bold">{t.options}</h3>
            <ol className="mt-3 grid gap-3" lang={lang}>
              {goal.constructed_options.map((o, i) => (
                <li key={o.goal} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 font-black text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{o.goal}</p>
                    <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{o.why_fits}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      <Section id="reality" n={number("reality")} title={t.sections.reality}>
        <div className={"rounded-3xl p-5 " + verdict.box}>
          <p className="flex items-center gap-2 font-extrabold">
            <span className={"flex size-8 items-center justify-center rounded-full text-base text-white " + verdict.pill} aria-hidden>
              {verdict.icon}
            </span>
            {t.verdicts[reality.verdict]}
          </p>
          <Prose lang={lang} className="mt-3">
            {reality.explanation}
          </Prose>
        </div>
        {reality.adjustment && (
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <h3 className="font-bold">{t.adjustment}</h3>
            <Prose lang={lang} className="mt-1.5">
              {reality.adjustment}
            </Prose>
          </div>
        )}
        <p className="mt-3 text-sm font-semibold text-muted">{t.choiceIsYours}</p>
      </Section>

      <Section id="path" n={number("path")} title={t.sections.path}>
        <Prose lang={lang} lead>
          {path.summary}
        </Prose>
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="font-bold">{t.routesTitle}</h3>
          <p className="text-xs text-muted">{t.routesNote}</p>
        </div>
        <div className="mt-3 space-y-3">
          {path.routes.map((route, i) => (
            <RouteCard key={i} route={route} t={t} lang={lang} open={i === 0} />
          ))}
        </div>
      </Section>

      <Section id="learning" n={number("learning")} title={t.sections.learning}>
        {learningStyles.length > 0 && (
          <p className="mb-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
            {fmt(t.yourStyle, { style: learningStyles.join(" + ") })}
          </p>
        )}
        <Prose lang={lang}>{path.learning_advice}</Prose>
      </Section>

      <Section id="future" n={number("future")} title={t.sections.future}>
        <div className="rounded-3xl bg-slate-50 p-5">
          <Prose lang={lang}>{path.future_outlook}</Prose>
        </div>
      </Section>

      <Section id="alternatives" n={number("alternatives")} title={t.sections.alternatives}>
        <div className="space-y-4">
          {alternatives.map((alt) => (
            <div key={alt.direction} className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-fuchsia-500/30 blur-3xl" aria-hidden />
              <div className="relative" lang={lang}>
                <p className="text-2xl font-black leading-tight tracking-tight">{alt.direction}</p>
                <h4 className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-300">{t.whyYou}</h4>
                <p className="mt-1 whitespace-pre-line leading-relaxed text-white/90">{alt.why_you}</p>
                <h4 className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-300">{t.potential}</h4>
                <p className="mt-1 whitespace-pre-line leading-relaxed text-white/90">{alt.potential}</p>
                <h4 className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-300">{t.firstSteps}</h4>
                <ol className="mt-2 space-y-2">
                  {alt.first_steps.map((s, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                        {j + 1}
                      </span>
                      <span className="leading-relaxed text-white/90">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="actNow" n={number("actNow")} title={t.sections.actNow}>
        <ActNowChecklist storageKey={`yw_report_${id}_act_now`} items={actNow} lang={lang} />
        <p className="mt-2 text-xs text-muted">{t.actNowNote}</p>
      </Section>

      <aside className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-muted">
        <p className="font-bold text-ink">{t.disclaimerTitle}</p>
        <p className="mt-1" lang={lang}>
          {content.disclaimer}
        </p>
        <p className="mt-1">{t.disclaimer}</p>
      </aside>

      {footer}
    </article>
  );
}

function Section({ id, n, title, children }: { id: SectionId; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-32 first-of-type:mt-8">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl" aria-hidden>
          {SECTION_ICONS[id]}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest text-brand-600">{n}</p>
          <h2 className="text-[1.4rem] font-extrabold leading-tight tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Текст от ИИ: абзацы (переносы строк сохраняются), удобный размер и межстрочный интервал.
function Prose({
  children,
  lang,
  lead = false,
  className = "",
}: {
  children: string;
  lang: string;
  lead?: boolean;
  className?: string;
}) {
  return (
    <p
      lang={lang}
      className={
        "whitespace-pre-line leading-relaxed " + (lead ? "text-[1.08rem] text-ink" : "text-[1.02rem] text-ink/90") + " " + className
      }
    >
      {children}
    </p>
  );
}

// Один вариант маршрута: заголовок с типом, сложностью, сроками и деньгами; по нажатию — шаги.
function RouteCard({ route, t, lang, open }: { route: ReportRoute; t: ReportDict; lang: string; open: boolean }) {
  const hard = route.effort_level === "hard";
  return (
    <details open={open} className="group rounded-3xl border border-slate-200 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
            <span aria-hidden>{ROUTE_ICONS[route.type]}</span>
            {t.routeTypes[route.type]}
          </span>
          <span
            className={
              "rounded-full px-2.5 py-1 " + (hard ? "bg-fuchsia-50 text-fuchsia-700" : "bg-emerald-50 text-emerald-700")
            }
          >
            {hard ? "▲▲ " : "▲ "}
            {t.effort[route.effort_level]}
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h4 lang={lang} className="text-lg font-extrabold leading-snug">
            {route.title}
          </h4>
          <span
            className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-ink/60 transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2" lang={lang}>
          <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">⏱ {t.time}</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold leading-snug">{route.time_estimate}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">💰 {t.cost}</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold leading-snug">{route.cost_range}</dd>
          </div>
        </dl>
      </summary>
      <div className="border-t border-slate-100 px-5 pb-5 pt-4" lang={lang}>
        <h5 className="text-xs font-bold uppercase tracking-widest text-muted">{t.steps}</h5>
        <ol className="relative mt-3 space-y-4 before:absolute before:bottom-2 before:left-[0.9rem] before:top-2 before:w-px before:bg-slate-200">
          {route.steps.map((step, i) => (
            <li key={i} className="relative flex gap-3">
              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        {route.requirements.length > 0 && (
          <>
            <h5 className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">{t.requirements}</h5>
            <ul className="mt-2 space-y-1.5">
              {route.requirements.map((r, i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-brand-500" aria-hidden>
                    ◆
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
          <h5 className="text-xs font-bold uppercase tracking-widest text-emerald-800">🏁 {t.outcome}</h5>
          <p className="mt-1 leading-relaxed text-emerald-950">{route.outcome}</p>
        </div>
        <p className="mt-4 border-l-4 border-slate-200 pl-3 text-[0.95rem] italic leading-relaxed text-muted">
          <span className="font-semibold not-italic text-ink/70">{t.tradeoff}: </span>
          {route.tradeoff_note}
        </p>
      </div>
    </details>
  );
}
