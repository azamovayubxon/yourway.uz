import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaButton } from "@/components/ui";
import { getDictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { getShareCard } from "@/lib/share";
import { TypeCard } from "../../teaser/TypeCard";

// Открытая страница «Поделиться» (этап 2б). Решение владельца: видно ТОЛЬКО название типа и три
// сильные стороны (снимок из ShareCard на момент нажатия кнопки). Портрета, направлений, ответов
// и 16-типа здесь нет — их нет и в самой таблице ShareCard. Страница закрыта от поисковиков
// (noindex), язык — язык карточки (= язык тизера), а не язык интерфейса. Несуществующий или
// удалённый (вместе с сессией/аккаунтом) код — 404. Превью для Telegram — opengraph-image.tsx рядом.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const card = await getShareCard((await params).code);
  if (!card) return { robots: { index: false, follow: false } };
  const t = getDictionary(card.locale).sharePage;
  const title = fmt(t.metaTitle, { type: card.typeLabel });
  return {
    title,
    description: t.ctaTitle,
    robots: { index: false, follow: false },
    openGraph: { title, description: t.ctaTitle, type: "website", siteName: "yourway.uz", locale: card.locale },
    twitter: { card: "summary_large_image", title, description: t.ctaTitle },
  };
}

export default async function SharedTypePage({ params }: Params) {
  const card = await getShareCard((await params).code);
  if (!card) notFound();
  const t = getDictionary(card.locale).sharePage;

  return (
    <div lang={card.locale} className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-14 pt-8">
      <TypeCard label={t.label} typeLabel={card.typeLabel} strengths={card.strengths} lang={card.locale} />
      <section className="rounded-[28px] border border-line bg-white p-6 text-center">
        <h2 className="text-xl font-extrabold leading-snug">{t.ctaTitle}</h2>
        <CtaButton href="/start" className="mt-5 w-full">
          {t.cta}
        </CtaButton>
      </section>
    </div>
  );
}
