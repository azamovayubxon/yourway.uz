import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { DeleteAccountForm } from "@/components/auth/DeleteAccountForm";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Удаление аккаунта из личного кабинета (этап 7, CLAUDE.md §6): с подтверждением паролем и чекбоксом.
export default async function DeleteAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/delete");
  const { t } = await getI18n();

  return (
    <PageShell title={t.auth.deleteAccount.title}>
      <div className="max-w-md space-y-5">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {t.auth.deleteAccount.subtitle}
        </p>
        <DeleteAccountForm t={t.auth} />
        <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-600">
          {t.auth.deleteAccount.backToAccount}
        </Link>
      </div>
    </PageShell>
  );
}
