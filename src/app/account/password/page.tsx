import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div className="mx-auto max-w-md px-4 pb-14 pt-8 lg:pt-12">
      <Link href="/account" className="focus-ring inline-flex min-h-11 items-center rounded text-sm font-semibold text-muted hover:text-ink">
        {t.auth.password.backToAccount}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight lg:text-[36px]">{t.auth.password.title}</h1>
      <p className="mt-2 leading-relaxed text-muted">{t.auth.password.subtitle}</p>
      <div className="mt-6 rounded-[28px] border border-line bg-white p-5 sm:p-6">
        <PasswordForm t={t.auth} />
      </div>
    </div>
  );
}
