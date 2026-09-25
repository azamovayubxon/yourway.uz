import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PageShell, PlaceholderNote } from "@/components/ui";
import { devToolsEnabled } from "@/lib/dev";
import { AI_FAIL_COOKIE } from "@/lib/report/dev";
import { getI18n } from "@/i18n/server";
import { setAiFailAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Служебная страница: включить или выключить имитацию сбоя ИИ для полного отчёта (только в этом
// браузере, на час). Нужна, чтобы проверить сообщение о сбое и кнопку «Сгенерировать заново».
export default async function DevAiFailPage() {
  if (!devToolsEnabled()) notFound();
  const { t } = await getI18n();
  const d = t.devAiFail;
  const on = (await cookies()).get(AI_FAIL_COOKIE)?.value === "1";
  return (
    <PageShell title={d.title}>
      <PlaceholderNote>{d.note}</PlaceholderNote>
      <p className={"rounded-2xl px-4 py-3 font-semibold " + (on ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900")}>
        {on ? d.stateOn : d.stateOff}
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        {d.howTo.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <form action={setAiFailAction}>
        <input type="hidden" name="on" value={on ? "0" : "1"} />
        <button className="min-h-12 rounded-2xl bg-ink px-6 font-bold text-white">{on ? d.turnOff : d.turnOn}</button>
      </form>
      <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
        {t.report.backToAccount} →
      </Link>
    </PageShell>
  );
}
