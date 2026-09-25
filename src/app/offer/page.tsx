import { PageShell, PlaceholderNote } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.pages.offer.title} — yourway.uz` };
}

export default async function OfferPage() {
  const { t } = await getI18n();
  const p = t.pages.offer;
  return (
    <PageShell title={p.title}>
      <PlaceholderNote>{t.common.placeholderNote}</PlaceholderNote>
      {p.body.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </PageShell>
  );
}
