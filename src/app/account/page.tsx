import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CtaButton, PageShell } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Аккаунт: кто вошёл, переход к портрету и выход.
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { t } = await getI18n();
  const session = await getCurrentSession();

  return (
    <PageShell title={t.auth.account.title}>
      <div className="max-w-md space-y-5">
        <p className="rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-muted">{t.auth.account.loggedInAs}</span> <b className="break-all">{user.login}</b>
        </p>
        {session?.status === "survey_done" ? (
          <CtaButton href="/teaser">{t.auth.account.toPortrait}</CtaButton>
        ) : (
          <CtaButton href="/start">{t.auth.account.toTests}</CtaButton>
        )}
        <form action={logoutAction} className="border-t border-slate-100 pt-5">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-2xl border-2 border-slate-200 px-5 font-semibold text-ink hover:border-slate-300"
          >
            {t.auth.account.logout}
          </button>
          <p className="mt-2 text-sm text-muted">{t.auth.account.logoutNote}</p>
        </form>
      </div>
    </PageShell>
  );
}
