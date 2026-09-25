import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Смена пароля из личного кабинета (этап 7).
export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/password");
  const { t } = await getI18n();

  return (
    <PageShell title={t.auth.password.title}>
      <div className="max-w-md space-y-5">
        <p className="text-muted">{t.auth.password.subtitle}</p>
        <PasswordForm t={t.auth} />
        <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
          {t.auth.password.backToAccount}
        </Link>
      </div>
    </PageShell>
  );
}
