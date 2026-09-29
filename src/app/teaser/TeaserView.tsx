import Link from "next/link";
import type { ReactNode } from "react";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt, formatSum } from "@/i18n/format";
import { MockBadge } from "./MockBadge";
import { RiasecMap } from "./RiasecMap";
import { StickySide } from "./StickySide";
import { TypeCard } from "./TypeCard";

// Страница бесплатного тизера (ТЗ 3.7.1, аудит §7; новый стиль — этап 2б): коллекционная карточка
// типа, «Поделиться» / «Сохранить картинку», портрет, «карта интересов» (RIASEC без чисел),
// ровно 3 сильные стороны, ровно 3 направления с пробной задачей, один бесплатный шаг,
// крючок-сюрприз под замком и платный блок с описанием пакета из единого источника тарифов.
// Тексты от ИИ — на языке тизера (teaserLocale), всё остальное — на языке интерфейса.
// surprise_direction_internal сюда не передаётся и пользователю не показывается.
//
// Раскладка (один DOM, CSS меняет только порядок). Ширина считается от самого блока (container
// queries, @container), а не от окна — так же страница выглядит и в узкой колонке /admin/compare:
//  • телефон и планшет (блок уже 896px) — одна колонка: карточка → кнопки → портрет → карта →
//    сильные стороны → направления → бесплатный шаг → загадка → оплата;
//  • компьютер (окно от ~1024px) — слева липкая колонка (карточка, кнопки, оплата), справа остальное.
//    Левая колонка в DOM идёт первой; на телефоне её обёртка — display: contents, а блок оплаты
//    уезжает вниз через order.

type TeaserDict = Dictionary["teaser"];

interface Props {
  t: TeaserDict;
  content: TeaserContent;
  teaserLocale: string;
  mock: boolean;
  // 16-тип под портретом (решение (И)): код и название на языке интерфейса.
  sixteenType: string;
  // Суммы баллов RIASEC из профиля (profile.riasec.scores) — для «карты интересов».
  riasecScores: Record<string, number>;
  // Кнопки «Поделиться» и «Сохранить картинку» (часть 2 этапа 2б); null — не показывать.
  shareActions: ReactNode;
  // Описание пакета рекомендованного уровня — из PACKAGE_FEATURES, единого источника тарифов
  // (аудит §7: «убрать список закрытых разделов», показать состав пакета как на /pricing).
  features: string[];
  recommendedLevel: "route" | "navigator";
  // Цена и название рекомендуемого уровня — из единого источника тарифов (аудит §7);
  // null, если цена ещё не задана в базе (тогда платный блок цену не показывает).
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

// Цвет полоски сверху у карточек направлений: терракота, бирюза, солнечный.
const DIRECTION_BARS = ["bg-brand-500", "bg-teal", "bg-sun"];

export function TeaserView({
  t,
  content,
  teaserLocale,
  mock,
  sixteenType,
  riasecScores,
  shareActions,
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
  const [code, ...typeNameParts] = sixteenType.split(" · ");

  return (
    <div className="@container mx-auto max-w-xl px-4 pb-12 pt-5 lg:max-w-6xl lg:px-8 lg:pt-8">
      {mock && <MockBadge label={t.mockBadge} note={t.mockNote} />}
      {otherLanguage}

      <div className="flex flex-col gap-6 @4xl:grid @4xl:grid-cols-[340px_minmax(0,1fr)] @4xl:items-start @4xl:gap-10 @5xl:grid-cols-[380px_minmax(0,1fr)] @5xl:gap-12">
        <StickySide className="contents @4xl:sticky @4xl:top-22 @4xl:flex @4xl:flex-col @4xl:gap-5 @4xl:self-start">
          <div className="order-1 @4xl:order-none">
            <TypeCard label={t.yourType} typeLabel={content.personality_type_label} strengths={strengths} lang={teaserLocale} />
          </div>

          {shareActions && <div className="order-2 @4xl:order-none">{shareActions}</div>}

          {reportHref && (
            <section className="order-4 rounded-[28px] border-2 border-teal bg-teal-50 p-5 text-center @4xl:order-none">
              <h2 className="text-lg font-extrabold text-teal">✓ {t.haveReportTitle}</h2>
              <Link
                href={reportHref}
                className="focus-ring mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-teal px-6 font-bold text-white"
              >
                {t.haveReportCta} →
              </Link>
            </section>
          )}

          {/* Платный блок (аудит §7, п.5): пакет и цена — из единого источника тарифов, разовая
              оплата, без подписки. Описание пакета вместо списка закрытых разделов — тот же
              состав, что на /pricing и на checkout (PACKAGE_FEATURES). */}
          <section className="order-5 rounded-[28px] border-2 border-brand-500 bg-white p-5 @4xl:order-none">
            <h2 className="text-xl font-extrabold leading-tight">{t.unlockTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.unlockText}</p>
            <div className="mt-4 rounded-2xl bg-app-bg p-4">
              <p className="text-sm">
                <span className="text-muted">{t.recommended}: </span>
                <b>{t.levels[recommendedLevel]}</b>
              </p>
              {recommendedPrice !== null && (
                <p className="mt-1 text-lg font-extrabold tabular-nums">
                  {fmt(t.priceLine, { name: t.levels[recommendedLevel], sum: formatSum(recommendedPrice, sumTemplate) })}
                </p>
              )}
              <h3 className="mt-3 text-sm font-bold">{t.tocTitle}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="font-bold text-brand-500" aria-hidden>
                      ✓
                    </span>
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={unlockHref}
              className="focus-ring mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-base font-bold text-white transition-colors hover:bg-brand-600 active:bg-brand-700"
            >
              <LockIcon className="size-5" open />
              {t.unlockCta}
            </Link>
            <p className="mt-2 text-center text-sm text-muted">{t.noSubscription}</p>
          </section>
        </StickySide>

        <div className="order-3 flex min-w-0 flex-col gap-6 @4xl:order-none @4xl:col-start-2 @4xl:row-start-1 @4xl:gap-8">
          <section className="rounded-[28px] border border-line bg-white p-5 sm:p-7">
            <p lang={teaserLocale} className="text-[1.05rem] leading-relaxed">
              {content.portrait}
            </p>
            {/* 16-тип — вторичной строкой, с объяснением, откуда он взялся (аудит §7): не отдельный
                тест, а расчёт по ответам о личности. */}
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="inline-block rounded-lg bg-sand px-2 py-0.5 font-bold text-ink">
                {code}
                {typeNameParts.length > 0 && <span className="font-semibold"> · {typeNameParts.join(" · ")}</span>}
              </span>
              <span>{t.sixteenTypeNote}</span>
            </p>
          </section>

          {lowQuality && (
            <aside className="rounded-[28px] border border-sun bg-sun-50 p-5">
              <p className="font-bold">💡 {t.lowQualityTitle}</p>
              <p className="mt-1.5 text-sm leading-relaxed">{t.lowQualityText}</p>
              <Link href="/start?new=1" className="focus-ring mt-3 inline-flex min-h-11 items-center font-semibold text-brand-600">
                {t.retakeCta} →
              </Link>
            </aside>
          )}

          <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @5xl:items-start">
            <RiasecMap
              scores={riasecScores}
              names={t.interestMap.names}
              title={t.interestMap.title}
              subtitle={t.interestMap.subtitle}
              strongest={t.interestMap.strongest}
            />

            <section>
              <h2 className="text-xl font-extrabold">{t.strengthsTitle}</h2>
              <ul className="mt-3 grid gap-3" lang={teaserLocale}>
                {strengths.map((s, i) => (
                  <li key={s} className="flex items-start gap-3 rounded-3xl border border-line bg-white p-4 font-semibold leading-snug">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display font-bold text-brand-600"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="pt-1">{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <h2 className="text-xl font-extrabold">{t.directionsTitle}</h2>
            <ol className="mt-3 grid gap-3 @4xl:grid-cols-3">
              {directions.map((d, i) => (
                <li key={d.title} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white">
                  <span className={`h-2 ${DIRECTION_BARS[i % DIRECTION_BARS.length]}`} aria-hidden />
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      {fmt(t.directionLabel, { n: i + 1 })}
                    </p>
                    <h3 lang={teaserLocale} className="mt-1 text-lg font-extrabold leading-snug">
                      {d.title}
                    </h3>
                    <p lang={teaserLocale} className="mt-1.5 text-sm leading-relaxed text-muted">
                      {d.one_liner}
                    </p>
                    {/* trial_task необязателен — старый активный промпт (до нажатия «Создать версию
                        из текста в коде» в /admin/prompts) его у ИИ не просит. */}
                    {d.trial_task && (
                      <p className="mt-3 rounded-2xl bg-app-bg px-3.5 py-3 text-sm leading-relaxed">
                        <span className="font-bold text-teal">{t.trialTaskLabel}: </span>
                        <span lang={teaserLocale}>{d.trial_task}</span>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className={`grid gap-6 ${content.free_step ? "@4xl:grid-cols-2" : ""}`}>
            {/* Один полезный бесплатный шаг (аудит §7, п.4): доступен уже сейчас, без оплаты.
                Необязательное поле — см. комментарий у trial_task выше. */}
            {content.free_step && (
              <section className="rounded-[28px] bg-teal-50 p-5 sm:p-6">
                <h2 className="flex items-start gap-2.5 text-lg font-extrabold leading-snug text-teal">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal text-sm text-white" aria-hidden>
                    ✓
                  </span>
                  {t.freeStepTitle}
                </h2>
                <p lang={teaserLocale} className="mt-2 leading-relaxed">
                  {content.free_step}
                </p>
              </section>
            )}

            {/* Крючок-сюрприз: направление названо только как факт, само оно — под замком. */}
            <section className="rounded-[28px] bg-ink p-5 text-on-dark sm:p-6">
              <h2 className="flex items-start gap-2.5 text-lg font-extrabold leading-snug">
                <LockIcon className="mt-0.5 size-5 shrink-0 text-sun" />
                {t.surpriseTitle}
              </h2>
              <p lang={teaserLocale} className="mt-2 leading-relaxed text-on-dark-muted">
                {content.surprise_hook}
              </p>
              <p className="mt-3 text-sm font-bold text-sun">{t.surpriseLocked}</p>
            </section>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted">{t.disclaimer}</p>

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
