import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { LoginForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth/credentials";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Вход по логину и паролю. Уже вошедшего человека сразу отправляем дальше.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextParam = (await searchParams).next;
  const next = nextParam ? safeNextPath(nextParam, "/account") : null;
  if (await getCurrentUser()) redirect(next ?? "/account");
  const { t } = await getI18n();
  return (
    <PageShell title={t.auth.login.title}>
      <div className="max-w-md">
        <LoginForm t={t.auth} next={next} />
      </div>
    </PageShell>
  );
}
