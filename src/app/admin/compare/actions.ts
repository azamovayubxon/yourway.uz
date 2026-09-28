"use server";

import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { rateComparison, startComparison } from "@/lib/compare";
import { isCompareKind, isComparePart, isVerdict, type CompareProfileSource } from "@/lib/compare/logic";

// Действия страницы «Сравнение моделей» (/admin/compare). Только superadmin — роль проверяется
// заново на сервере в каждом действии.

function isProfileSource(value: string): value is CompareProfileSource {
  return value === "golden" || value === "golden_no_goal" || value === "session";
}

export async function startComparisonAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const source = String(formData.get("source") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const part = String(formData.get("part") ?? "");
  if (!isProfileSource(source) || !isCompareKind(kind)) redirect("/admin/compare?error=bad_input");
  const result = await startComparison({
    adminId: admin.id,
    adminLogin: admin.login,
    source,
    sessionId: String(formData.get("sessionId") ?? ""),
    kind,
    part: isComparePart(part) ? part : null,
    models: [String(formData.get("model1") ?? ""), String(formData.get("model2") ?? "")],
  });
  redirect(result.ok ? `/admin/compare?id=${result.id}` : `/admin/compare?error=${result.error}`);
}

export async function rateComparisonAction(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const verdict = String(formData.get("verdict") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/compare?error=bad_input");
  if (!isVerdict(verdict)) redirect(`/admin/compare?id=${id}&error=no_verdict`);
  await rateComparison(id, verdict, String(formData.get("comment") ?? ""));
  redirect(`/admin/compare?id=${id}`);
}
