import { Steps } from "@/components/blocks";
import { CtaButton, PageShell, PlaceholderNote } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.pages.howItWorks.title} — yourway.uz` };
}

export default async function HowItWorksPage() {
  const { t } = await getI18n();
  const p = t.pages.howItWorks;
  return (
    <PageShell title={p.title}>
      <PlaceholderNote>{t.common.placeholderNote}</PlaceholderNote>
      <p className="text-lg text-muted">{p.intro}</p>
      <Steps t={t} />
      <h2 className="pt-4 text-xl font-bold">{p.honestyTitle}</h2>
      <p>{p.honesty}</p>
      <div className="pt-4">
        <CtaButton href="/start">{t.common.startFree}</CtaButton>
      </div>
    </PageShell>
  );
}
