import { FaqList } from "@/components/blocks";
import { PageShell, PlaceholderNote } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.pages.faq.title} — yourway.uz` };
}

export default async function FaqPage() {
  const { t } = await getI18n();
  return (
    <PageShell title={t.pages.faq.title}>
      <PlaceholderNote>{t.common.placeholderNote}</PlaceholderNote>
      <FaqList t={t} />
    </PageShell>
  );
}
