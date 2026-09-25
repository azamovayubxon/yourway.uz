import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import { RecoverForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/credentials";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// «Забыли пароль?»: логин + код восстановления → новый пароль и новый код.
export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getI18n();
  const nextParam = (await searchParams).next;
  const next = nextParam ? safeNextPath(nextParam, "/account") : null;
  const user = await getCurrentUser();
  return (
    <PageShell title={t.auth.recover.title}>
      <div className="max-w-md">
        <RecoverForm t={t.auth} next={next} already={user?.login ?? null} />
      </div>
    </PageShell>
  );
}
