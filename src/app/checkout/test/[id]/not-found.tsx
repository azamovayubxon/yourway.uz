import { CtaButton, PageShell } from "@/components/ui";
import { getI18n } from "@/i18n/server";

// Закрытый доступ к тестовой оплате (ТЗ аудита §13, этап C2): чужой id, несуществующий платёж или
// тестовая оплата выключена — не голая 404, а понятное объяснение и кнопка назад к выбору тарифа.
export default async function TestPaymentNotFound() {
  const { t } = await getI18n();
  return (
    <PageShell title={t.accessDenied.title}>
      <p className="text-muted">{t.accessDenied.checkoutText}</p>
      <CtaButton href="/checkout">{t.accessDenied.checkoutCta} →</CtaButton>
    </PageShell>
  );
}
