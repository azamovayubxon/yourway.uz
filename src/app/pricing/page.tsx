import { PricingPlans } from "@/components/blocks";
import { CtaButton, PageShell, PlaceholderNote } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.pages.pricing.title} — yourway.uz` };
}

export default async function PricingPage() {
  const { t } = await getI18n();
  const p = t.pages.pricing;
  return (
    <PageShell title={p.title}>
      <PlaceholderNote>{t.common.placeholderNote}</PlaceholderNote>
      <p className="text-lg text-muted">{p.intro}</p>
      <PricingPlans t={t} />
      <p className="text-sm text-muted">{p.paymentNote}</p>
      <div className="pt-4">
        <CtaButton href="/start">{t.common.startFree}</CtaButton>
      </div>
    </PageShell>
  );
}
