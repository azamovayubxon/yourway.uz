import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import { RegisterForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/credentials";
import { getCurrentSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Регистрация (ТЗ 3.2): появляется только перед оплатой — сюда ведёт кнопка «Открыть полный отчёт» на тизере.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getI18n();
  const nextParam = (await searchParams).next;
  const next = nextParam ? safeNextPath(nextParam, "/account") : null;
  const [user, session] = await Promise.all([getCurrentUser(), getCurrentSession()]);
  return (
    <PageShell title={t.auth.register.title}>
      <div className="max-w-md">
        <RegisterForm
          t={t.auth}
          next={next}
          already={user?.login ?? null}
          keepResults={!!session && !session.userId}
          terms={{ offer: t.footer.offer, privacy: t.footer.privacy }}
        />
      </div>
    </PageShell>
  );
}
