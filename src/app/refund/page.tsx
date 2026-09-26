import { PageShell } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: `${t.pages.refund.title} — yourway.uz` };
}

export default async function RefundPage() {
  const { t } = await getI18n();
  const p = t.pages.refund;
  return (
    <PageShell title={p.title}>
      {p.body.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </PageShell>
  );
}
