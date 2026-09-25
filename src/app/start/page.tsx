import Link from "next/link";
import { PageShell } from "@/components/ui";
import { getI18n } from "@/i18n/server";

// Заглушка воронки. Экран-развилка и тесты появятся на этапе 2.
export default async function StartPage() {
  const { t } = await getI18n();
  return (
    <PageShell title={t.start.title}>
      <p className="text-lg text-muted">{t.start.text}</p>
      <Link href="/" className="inline-block py-2 font-semibold text-brand-600">
        ← {t.common.backHome}
      </Link>
    </PageShell>
  );
}
