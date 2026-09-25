import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Все страницы /admin/**: нужна роль admin или superadmin (см. src/lib/admin). Незалогиненным
// и обычным пользователям — обычная 404 (requireAdmin), чтобы не палить, что раздел есть.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
