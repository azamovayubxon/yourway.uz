import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { effectiveRole, isAdminRole, type AdminRole } from "./role";

export interface AdminUser {
  id: string;
  login: string;
  role: AdminRole;
}

// Один запрос роли на всю отрисовку страницы (layout + сама страница), как getCurrentUser.
const currentAdminRole = cache(async (): Promise<AdminUser | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const full = await getDb().user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (!full) return null;
  const role = effectiveRole({ login: user.login, role: full.role });
  if (!isAdminRole(role)) return null;
  return { id: user.id, login: user.login, role };
});

// Доступ к /admin/**: нужен вход в аккаунт с ролью admin или superadmin (см. role.ts).
// Всем остальным (включая не вошедших) — обычная 404, чтобы не выдавать, что раздел вообще есть.
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdminRole();
  if (!admin) notFound();
  return admin;
}

export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.role !== "superadmin") notFound();
  return admin;
}
