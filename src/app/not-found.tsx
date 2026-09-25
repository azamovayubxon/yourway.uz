import Link from "next/link";
import { PageShell } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <PageShell title={t.notFound.title}>
      <p className="text-muted">{t.notFound.text}</p>
      <Link href="/" className="inline-block py-2 font-semibold text-brand-600">
        ← {t.common.backHome}
      </Link>
    </PageShell>
  );
}
