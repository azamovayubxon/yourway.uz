import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAiMode } from "@/lib/ai/providers";
import { getCurrentUser } from "@/lib/auth";
import { uzSixteenTypeName } from "@/lib/ai/uz-resources";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { Profile } from "@/lib/assessment/profile";
import { SIXTEEN_TYPES } from "@/lib/assessment/tests";
import { devToolsEnabled } from "@/lib/dev";
import { getCurrentSession } from "@/lib/session";
import { canGenerateInLocale, getSessionTeasers } from "@/lib/teaser";
import { buildLockedToc } from "@/lib/teaser/toc";
import type { Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { TeaserGenerator } from "./TeaserGenerator";
import { TeaserView } from "./TeaserView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Бесплатный тизер (Приложение А §11, шаг 7). Какой экран показать:
//  1) готовый тизер на языке интерфейса;
//  2) иначе, если не просили «сделать на другом языке» (?generate=1), — готовый тизер на другом языке
//     с кнопкой «составить на языке интерфейса» (решение (Л));
//  3) иначе — экран генерации (он сам запускает генерацию и показывает ошибки/лимиты).
export default async function TeaserPage({ searchParams }: { searchParams: Promise<{ generate?: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/start");
  if (session.status === "in_progress") redirect("/test");
  const profile = session.profile as Profile | null;
  if (session.status !== "survey_done" || !profile) redirect("/survey");

  const { locale, t } = await getI18n();
  const wantsGenerate = (await searchParams).generate === "1";
  const teasers = await getSessionTeasers(session.id);
  const current = teasers.find((x) => x.locale === locale);
  const readyOther = teasers.find((x) => x.locale !== locale && x.status === "ready");

  const shown =
    current?.status === "ready" ? current : !wantsGenerate && current?.status !== "generating" ? readyOther : undefined;

  if (!shown) {
    return <TeaserGenerator t={t.teaser} mock={getAiMode() === "mock"} restartLabel={t.teaser.retakeCta} />;
  }

  const teaserLocale = shown.locale as Locale;
  const content = shown.content as unknown as TeaserContent;
  const code = profile.sixteen_type.code;
  // Узбекское название 16-типа — из глоссария docs/uz-glossary.md, русское — из mapping-файла.
  const typeName =
    (locale === "uz" ? uzSixteenTypeName(code) : undefined) ?? SIXTEEN_TYPES[code]?.[locale] ?? profile.sixteen_type.nickname;
  const general = [...t.teaser.generalToc];
  general.splice(4, 0, t.teaser.pathToc[profile.path_type]);

  let otherLanguage = null;
  if (teaserLocale !== locale) {
    const canRegen = await canGenerateInLocale(session.id, locale);
    otherLanguage = (
      <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm">
        <p className="text-muted">{fmt(t.teaser.otherLanguage, { lang: t.teaser.languageNames[teaserLocale] })}</p>
        {canRegen ? (
          <Link
            href="/teaser?generate=1"
            className="mt-1 inline-flex min-h-11 items-center font-semibold text-brand-600"
          >
            {fmt(t.teaser.makeInLanguage, { lang: t.teaser.languageNames[locale] })} →
          </Link>
        ) : (
          <p className="mt-1 text-muted">{t.teaser.langRegenUsed}</p>
        )}
      </div>
    );
  }

  return (
    <TeaserView
      t={t.teaser}
      content={content}
      teaserLocale={teaserLocale}
      mock={shown.aiMode === "mock"}
      sixteenType={`${code} · ${typeName}`}
      toc={buildLockedToc(content.locked_toc, general)}
      recommendedLevel={profile.level}
      lowQuality={profile.answer_quality?.level === "low"}
      otherLanguage={otherLanguage}
      // Выбор уровня и оплата — этап 6; пока после регистрации человек попадает на страницу цен.
      unlockHref={(await getCurrentUser()) ? "/pricing" : "/register?next=/pricing"}
      footer={
        <div className="mt-8 space-y-1 text-center">
          <Link
            href="/start?new=1"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-muted underline"
          >
            {t.start.restart}
          </Link>
          {devToolsEnabled() && (
            <Link href={`/dev/profile/${session.id}`} className="block py-2 text-sm font-semibold text-brand-600">
              {t.teaser.devLink} →
            </Link>
          )}
        </div>
      }
    />
  );
}
