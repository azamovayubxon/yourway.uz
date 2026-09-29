import Link from "next/link";
import type { ReactNode } from "react";
import { MockBadge } from "@/app/teaser/MockBadge";
import { FlowLabel } from "@/components/flow";
import { CompassMark } from "@/components/Logo";
import type { ReportContent, ReportRoute } from "@/lib/ai/report-schema";
import { buildFirstScreen } from "@/lib/report/present";
import { splitIntoParagraphs } from "@/lib/report/paragraphs";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { Checklist, ReportNav, RouteSwitcher } from "./ReportClient";

// Полный отчёт онлайн (ТЗ 3.10.1, Приложение Б §7) — то, за что человек заплатил. Новый стиль
// (этап 3): шапка с целью крупно, бирюзовая карточка «Qisqacha aytganda», разделы с
// терракотовыми номерами, на компьютере — оглавление слева с «Oʻqildi», на телефоне — плавающая
// кнопка «Boʻlimlar». Тексты от ИИ — на языке отчёта (reportLocale), всё остальное — на языке
// интерфейса.

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
  // Полная строка о языке отчёта (аудит UX-06) — внизу, у дисклеймера.
  languageNote: string;
  // Короткая «таблетка» языка в шапке: «Hisobot tili: oʻzbek».
  languageShort: string;
  footer: ReactNode;
  // Показать только эти разделы (сравнение моделей в /admin/compare: одна часть отчёта в том же
  // оформлении, что видит пользователь). Без оглавления, панели PDF и первого экрана — они
  // собираются из всего отчёта; шапка — только вместе с портретом. Не задано — весь отчёт.
  sections?: SectionId[];
}

const SECTION_IDS = ["portrait", "goal", "reality", "path", "plan30", "learning", "future", "alternatives", "actNow"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// Цвет подписи типа варианта маршрута на белой карточке (контраст ≥ 4.5).
const ROUTE_KICKER: Record<ReportRoute["type"], string> = {
  local_cheap: "text-brand-500",
  online: "text-teal",
  abroad: "text-sun-ink",
};

// Вердикт по цели — цветная плашка.
const VERDICT_STYLES = {
  fits: { box: "bg-teal-50 text-ink", icon: "bg-teal text-white" },
  ambitious: { box: "bg-sun-100 text-sun-ink", icon: "bg-sun text-ink" },
  mismatch: { box: "bg-brand-50 text-brand-700", icon: "bg-brand-500 text-white" },
} as const;

// Крупный заголовок — цель. Она бывает и короткой («Аналитик данных»), и целой фразой — кегль
// подбирается по длине, чтобы длинная цель не занимала весь первый экран.
function goalTitleClass(text: string): string {
  if (text.length <= 48) return "text-[30px] lg:text-[44px]";
  if (text.length <= 110) return "text-[24px] lg:text-[34px]";
  return "text-[20px] lg:text-[26px]";
}

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
  languageNote,
  languageShort,
  footer,
  sections,
}: Props) {
  const partial = sections !== undefined;
  const shown = (s: SectionId) => !sections || sections.includes(s);
  const { portrait, goal, reality_check: reality, main_path: path, alternatives, act_now: actNow } = content;
  const lang = reportLocale;
  // plan_30_days — новое поле схемы (report-2.0, этап C1). У старых отчётов (report-1.0) его нет —
  // раздел просто не показываем, а не рендерим пустой блок.
  const plan30Days = content.plan_30_days;
  const order = SECTION_IDS.filter((s) => s !== "plan30" || (plan30Days && plan30Days.length > 0));
  const nav = order.map((s) => ({ id: s, title: t.sections[s] }));
  const number = (s: SectionId) => order.indexOf(s) + 1;
  const verdict = VERDICT_STYLES[reality.verdict];
  const firstScreen = buildFirstScreen(content);
  const pdfHref = `/api/report/${id}/pdf`;

  return (
    <div className={"mx-auto max-w-6xl px-4 pt-4 " + (partial ? "pb-14" : "pb-28 lg:pb-16")}>
      {/* Панель над отчётом: «Все отчёты» и PDF. Одна ссылка PDF на все ширины: на телефоне —
          маленькая «таблетка», на компьютере — тёмная кнопка «PDF yuklab olish». */}
      {!partial && (
        <div className="flex items-center justify-between gap-3 print:hidden lg:justify-end lg:gap-5 lg:border-b lg:border-line lg:pb-4">
          <Link href="/account" className="focus-ring inline-flex min-h-11 items-center rounded text-sm font-semibold text-muted hover:text-ink">
            <span aria-hidden className="mr-1 lg:hidden">←</span>
            {t.backToAccount}
          </Link>
          <a
            href={pdfHref}
            aria-label={t.downloadPdf}
            className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink hover:border-ink lg:border-ink lg:bg-ink lg:px-5 lg:text-on-dark lg:hover:bg-ink/90"
          >
            <DownloadIcon />
            <span className="lg:hidden">PDF</span>
            <span className="hidden lg:inline">{t.downloadPdf}</span>
          </a>
        </div>
      )}

      <div className={partial ? "" : "mt-4 lg:mt-8 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12"}>
        {!partial && (
          <ReportNav items={nav} tocLabel={t.toc} sectionsButton={t.sectionsButton} readLabel={t.readProgress} />
        )}
        <article className="min-w-0 max-w-3xl">
          {mockBadge && <MockBadge label={mockBadge.label} note={mockBadge.note} />}

          {/* Шапка: метка уровня, цель крупно, дата и язык. */}
          {shown("portrait") && (
            <header>
              <FlowLabel>{fmt(t.kicker, { level: levelName })}</FlowLabel>
              <h1
                lang={lang}
                className={"mt-2 break-words font-extrabold leading-[1.1] tracking-tight " + goalTitleClass(goal.statement)}
              >
                {goal.statement}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-sand px-3 py-1 text-muted">{fmt(t.createdAt, { date })}</span>
                <span className="rounded-full bg-sand px-3 py-1 text-muted">{languageShort}</span>
              </div>
            </header>
          )}

          {/* «Qisqacha aytganda» (ТЗ аудита §9): короткий вывод, направление, первый шаг,
              ограничения — собраны из уже готового отчёта, отдельно от ИИ не запрашиваются.
              Раскладка — сетка .yw-first (globals.css): на телефоне кнопки под плитками, на
              компьютере — под выводом, плитки справа. */}
          {!partial && (
            <section aria-labelledby="first-screen-title" className="yw-first mt-6 rounded-[28px] bg-teal p-5 text-white sm:p-7">
              <div className="yw-first-text">
                <h2 id="first-screen-title" className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-on-teal-muted">
                  {t.firstScreen.title}
                </h2>
                <p lang={lang} className="mt-2 text-[1.05rem] leading-relaxed lg:text-lg">
                  {firstScreen.takeaway}
                </p>
              </div>
              <dl className="yw-first-tiles grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-teal-800 p-3.5">
                  <dt className="text-xs text-on-teal-muted">{t.firstScreen.directionLabel}</dt>
                  <dd lang={lang} className="mt-1 font-bold leading-snug">
                    {firstScreen.direction}
                  </dd>
                </div>
                <div className="rounded-2xl bg-teal-800 p-3.5">
                  <dt className="text-xs text-on-teal-muted">{t.firstScreen.firstStepLabel}</dt>
                  <dd lang={lang} className="mt-1 font-bold leading-snug">
                    {firstScreen.firstStep}
                  </dd>
                </div>
                {firstScreen.constraints && (
                  <div className="col-span-2 rounded-2xl bg-teal-800 p-3.5 text-sm leading-relaxed">
                    <dt className="inline font-bold">{t.firstScreen.constraintsLabel}: </dt>
                    <dd lang={lang} className="inline text-on-teal-muted">
                      {firstScreen.constraints}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="yw-first-cta flex flex-wrap gap-2 print:hidden">
                <a
                  href="#path"
                  className="focus-ring-light inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-teal hover:bg-teal-50"
                >
                  {t.firstScreen.compareCta}
                </a>
                <a
                  href="#actNow"
                  className="focus-ring-light inline-flex min-h-11 items-center rounded-full bg-teal-800 px-5 text-sm font-bold text-white hover:bg-ink"
                >
                  {t.firstScreen.weekPlanCta}
                </a>
              </div>
            </section>
          )}

          {shown("portrait") && (
            <Section id="portrait" n={number("portrait")} title={t.sections.portrait}>
              <div className="mb-5 inline-flex max-w-full items-center gap-3 rounded-2xl bg-teal px-4 py-3 text-white">
                <CompassMark size={30} variant="dark" />
                <span className="min-w-0">
                  <span className="block text-xs text-on-teal-muted">{t.yourType}</span>
                  <span lang={lang} className="block break-words font-display text-lg font-bold leading-tight">
                    {portrait.type_label}
                  </span>
                  <span className="block text-xs text-on-teal-muted">{sixteenType}</span>
                </span>
              </div>
              <Prose lang={lang} lead>
                {portrait.summary}
              </Prose>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-teal-50 p-5">
                  <h3 className="font-bold text-teal">{t.strengths}</h3>
                  <ul className="mt-2.5 space-y-2" lang={lang}>
                    {portrait.strengths.map((s) => (
                      <li key={s} className="flex gap-2.5 leading-snug">
                        <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full bg-teal" />
                        <span className="font-semibold">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-sun-100 p-5 text-sun-ink">
                  <h3 className="font-bold">{t.watchouts}</h3>
                  <ul className="mt-2.5 space-y-2" lang={lang}>
                    {portrait.watchouts.map((w) => (
                      <li key={w} className="flex gap-2.5 leading-snug">
                        <span aria-hidden className="mt-[0.45em] size-2 shrink-0 rounded-full bg-sun" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          {shown("goal") && (
            <Section id="goal" n={number("goal")} title={t.sections.goal}>
              <figure className="rounded-3xl border border-line bg-white p-5">
                <figcaption className="text-xs font-bold uppercase tracking-wider text-brand-500">
                  {goal.source === "stated" ? t.goalStated : t.goalConstructed}
                </figcaption>
                <blockquote lang={lang} className="mt-2 font-display text-lg font-bold leading-snug">
                  {goal.statement}
                </blockquote>
              </figure>
              {goal.constructed_options.length > 0 && (
                <>
                  <h3 className="mt-6 font-bold">{t.options}</h3>
                  <ol className="mt-3 grid gap-3" lang={lang}>
                    {goal.constructed_options.map((o, i) => (
                      <li key={o.goal} className="flex gap-4 rounded-3xl border border-line bg-white p-4">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display font-bold text-brand-700">
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
          )}

          {shown("reality") && (
            <Section id="reality" n={number("reality")} title={t.sections.reality}>
              <div className={"rounded-3xl p-5 " + verdict.box}>
                <p className="flex items-center gap-2.5 font-display text-lg font-bold">
                  <span className={"flex size-8 shrink-0 items-center justify-center rounded-xl " + verdict.icon} aria-hidden>
                    <VerdictIcon verdict={reality.verdict} />
                  </span>
                  {t.verdicts[reality.verdict]}
                </p>
                <Prose lang={lang} className="mt-3" inherit>
                  {reality.explanation}
                </Prose>
              </div>
              {reality.adjustment && (
                <div className="mt-3 rounded-3xl border border-line bg-white p-5">
                  <h3 className="font-bold">{t.adjustment}</h3>
                  <Prose lang={lang} className="mt-1.5">
                    {reality.adjustment}
                  </Prose>
                </div>
              )}
              <p className="mt-3 text-sm font-semibold text-muted">{t.choiceIsYours}</p>
            </Section>
          )}

          {shown("path") && (
            <Section id="path" n={number("path")} title={t.sections.path}>
              <Prose lang={lang} lead>
                {path.summary}
              </Prose>
              <h3 className="mt-6 font-bold">{t.routesTitle}</h3>
              <div className="mt-3">
                <RouteSwitcher
                  label={t.routesTitle}
                  cards={path.routes.map((r) => ({
                    kicker: t.routeTypes[r.type],
                    kickerClass: ROUTE_KICKER[r.type],
                    title: r.title,
                    meta: `${r.time_estimate} · ${r.cost_range}`,
                  }))}
                >
                  {path.routes.map((route, i) => (
                    <RouteDetails key={i} route={route} t={t} lang={lang} />
                  ))}
                </RouteSwitcher>
              </div>
              <p className="mt-3 text-xs text-muted">{t.routesNote}</p>
            </Section>
          )}

          {shown("plan30") && plan30Days && plan30Days.length > 0 && (
            <Section id="plan30" n={number("plan30")} title={t.sections.plan30}>
              <Checklist
                storageKey={`yw_report_${id}_plan30`}
                lang={lang}
                items={plan30Days.map((item) => ({
                  text: item.task,
                  note: (
                    <>
                      <span className="font-semibold text-ink">{t.plan30Result}: </span>
                      {item.expected_result}
                    </>
                  ),
                }))}
              />
              <p className="mt-2 text-xs text-muted">{t.actNowNote}</p>
            </Section>
          )}

          {shown("learning") && (
            <Section id="learning" n={number("learning")} title={t.sections.learning}>
              {learningStyles.length > 0 && (
                <p className="mb-3 inline-flex rounded-full bg-brand-50 px-3.5 py-1 text-sm font-semibold text-brand-700">
                  {fmt(t.yourStyle, { style: learningStyles.join(" + ") })}
                </p>
              )}
              <Prose lang={lang}>{path.learning_advice}</Prose>
            </Section>
          )}

          {shown("future") && (
            <Section id="future" n={number("future")} title={t.sections.future}>
              <div className="rounded-3xl bg-sand p-5">
                <Prose lang={lang}>{path.future_outlook}</Prose>
              </div>
            </Section>
          )}

          {shown("alternatives") && (
            <Section id="alternatives" n={number("alternatives")} title={t.sections.alternatives}>
              <div className={"grid gap-4 " + (alternatives.length > 1 ? "xl:grid-cols-2" : "")}>
                {alternatives.map((alt, i) => {
                  const tone = i % 2 === 0 ? { bar: "bg-brand-500", label: "text-brand-500" } : { bar: "bg-teal", label: "text-teal" };
                  return (
                    <div key={alt.direction} className="overflow-hidden rounded-3xl border border-line bg-white">
                      <div className={"h-2 " + tone.bar} aria-hidden />
                      <div className="p-5" lang={lang}>
                        <h3 className="font-display text-xl font-extrabold leading-tight">{alt.direction}</h3>
                        <h4 className={"mt-4 text-xs font-bold uppercase tracking-wider " + tone.label}>{t.whyYou}</h4>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{alt.why_you}</p>
                        <h4 className={"mt-4 text-xs font-bold uppercase tracking-wider " + tone.label}>{t.potential}</h4>
                        <p className="mt-1 whitespace-pre-line leading-relaxed">{alt.potential}</p>
                        <h4 className={"mt-4 text-xs font-bold uppercase tracking-wider " + tone.label}>{t.firstSteps}</h4>
                        <ol className="mt-2 space-y-2">
                          {alt.first_steps.map((s, j) => (
                            <li key={j} className="flex gap-3">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sand text-xs font-bold">
                                {j + 1}
                              </span>
                              <span className="leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {shown("actNow") && (
            <Section id="actNow" n={number("actNow")} title={t.sections.actNow}>
              <Checklist storageKey={`yw_report_${id}_act_now`} items={actNow.map((text) => ({ text }))} lang={lang} />
              <p className="mt-2 text-xs text-muted">{t.actNowNote}</p>
            </Section>
          )}

          {shown("actNow") && (
            <aside className="mt-12 rounded-3xl bg-sand p-5 text-sm leading-relaxed text-muted">
              <p className="font-bold text-ink">{t.disclaimerTitle}</p>
              <p className="mt-1" lang={lang}>
                {content.disclaimer}
              </p>
              <p className="mt-1">{t.disclaimer}</p>
              <p className="mt-3 border-t border-line pt-3">{languageNote}</p>
            </aside>
          )}

          {footer}
        </article>
      </div>
    </div>
  );
}

function Section({ id, n, title, children }: { id: SectionId; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-12 scroll-mt-24 first-of-type:mt-8">
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 font-display text-base font-bold text-white"
          aria-hidden
        >
          {n}
        </span>
        <h2 id={`${id}-title`} className="text-[1.4rem] font-extrabold leading-tight tracking-tight lg:text-[1.6rem]">
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Текст от ИИ: абзацы удобного размера. Длинные блоки делятся при отображении по границам
// предложений (ТЗ аудита §9, «абзац — одна мысль, ориентир 40–80 слов») — сам текст не меняется,
// только показывается частями. inherit — цвет текста берётся от цветной плашки.
function Prose({
  children,
  lang,
  lead = false,
  inherit = false,
  className = "",
}: {
  children: string;
  lang: string;
  lead?: boolean;
  inherit?: boolean;
  className?: string;
}) {
  const paragraphs = splitIntoParagraphs(children);
  const color = inherit ? "" : lead ? "text-ink" : "text-ink/90";
  return (
    <div lang={lang} className={"space-y-3 " + className}>
      {paragraphs.map((p, i) => (
        <p key={i} className={"leading-relaxed " + (lead ? "text-[1.08rem] " : "text-[1.02rem] ") + color}>
          {p}
        </p>
      ))}
    </div>
  );
}

// Подробности одного варианта маршрута: плашки «Muddat/Xarajat», шаги — таймлайн с точками,
// что понадобится, результат, «легко или трудно» и «Nimani oʻzingiz tekshirishingiz kerak».
function RouteDetails({ route, t, lang }: { route: ReportRoute; t: ReportDict; lang: string }) {
  const hard = route.effort_level === "hard";
  const n = route.steps.length;
  const dot = (i: number) => (i === n - 1 ? "bg-sun" : i === n - 2 && n > 2 ? "bg-teal" : "bg-brand-500");
  return (
    <div className="mt-4 rounded-3xl border border-line bg-white p-5" lang={lang}>
      <p className={"text-xs font-bold uppercase tracking-wider " + ROUTE_KICKER[route.type]}>{t.routeTypes[route.type]}</p>
      <h4 className="mt-1 font-display text-lg font-bold leading-snug">{route.title}</h4>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-sand px-3 py-1">
          <b>{t.time}:</b> {route.time_estimate}
        </span>
        <span className="rounded-full bg-sand px-3 py-1">
          <b>{t.cost}:</b> {route.cost_range}
        </span>
        <span className={"rounded-full px-3 py-1 font-semibold " + (hard ? "bg-brand-50 text-brand-700" : "bg-teal-50 text-teal")}>
          {t.effort[route.effort_level]}
        </span>
      </div>

      <h5 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t.steps}</h5>
      <ol className="relative mt-3 space-y-4 before:absolute before:bottom-3 before:left-[5px] before:top-2 before:w-0.5 before:bg-line">
        {route.steps.map((step, i) => (
          <li key={i} className="relative flex gap-3.5">
            <span className={"relative mt-[0.4em] size-3 shrink-0 rounded-full ring-4 ring-white " + dot(i)} aria-hidden />
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      {route.requirements.length > 0 && (
        <>
          <h5 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t.requirements}</h5>
          <ul className="mt-2 space-y-1.5">
            {route.requirements.map((r, i) => (
              <li key={i} className="flex gap-2.5 leading-relaxed">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-5 rounded-2xl bg-sand p-4">
        <h5 className="text-xs font-bold uppercase tracking-wider text-muted">{t.outcome}</h5>
        <p className="mt-1 leading-relaxed">{route.outcome}</p>
      </div>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
        <span className="font-semibold text-ink">{t.tradeoff}: </span>
        {route.tradeoff_note}
      </p>
      {/* what_to_check — новое поле схемы (report-2.0, этап C1): у старых отчётов (report-1.0)
          его нет, поэтому рендерим только когда есть (ТЗ аудита §9 «Реальные возможности и источники»). */}
      {route.what_to_check && (
        <p className="mt-4 rounded-2xl bg-teal-50 p-4 text-[0.95rem] leading-relaxed">
          <span className="font-bold text-ink">{t.whatToCheck}: </span>
          {route.what_to_check}
        </p>
      )}
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: keyof typeof VERDICT_STYLES }) {
  const path =
    verdict === "fits" ? "M5 12.5 10 17.5 19 7" : verdict === "ambitious" ? "M6 17 17 6M9 6h8v8" : "M4 12h12M12 6l6 6-6 6";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-4" focusable="false">
      <path d={path} />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0" aria-hidden focusable="false">
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </svg>
  );
}
