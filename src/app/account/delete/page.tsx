import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div className="mx-auto max-w-md px-4 pb-14 pt-8 lg:pt-12">
      <Link href="/account" className="focus-ring inline-flex min-h-11 items-center rounded text-sm font-semibold text-muted hover:text-ink">
        {t.auth.deleteAccount.backToAccount}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight lg:text-[36px]">{t.auth.deleteAccount.title}</h1>
      <p className="mt-4 rounded-3xl bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-700">{t.auth.deleteAccount.subtitle}</p>
      <div className="mt-6 rounded-[28px] border border-line bg-white p-5 sm:p-6">
        <DeleteAccountForm t={t.auth} />
      </div>
    </div>
  );
}
