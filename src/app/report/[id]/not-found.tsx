import Link from "next/link";
import { PageShell } from "@/components/ui";
import { getI18n } from "@/i18n/server";

// Закрытый доступ к отчёту (ТЗ аудита §13, этап C2): чужой id или несуществующий отчёт — не голая
// 404 «страница не найдена», а понятное объяснение и кнопка «Мои отчёты». К этому моменту человек
// уже вошёл в аккаунт (без входа страница отчёта перенаправляет на /login раньше, чем сюда дойдёт) —
// значит, дело либо в чужом id, либо в устаревшей ссылке; ни то, ни другое мы не раскрываем подробнее.
export default async function ReportNotFound() {
  const { t } = await getI18n();
  return (
    <PageShell title={t.accessDenied.title}>
      <p className="text-muted">{t.accessDenied.reportText}</p>
      <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
        {t.accessDenied.accountCta} →
      </Link>
    </PageShell>
  );
}
