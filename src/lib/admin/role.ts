// Кто считается администратором (этап 8). Без единой SQL-команды: суперадминов достаточно
// перечислить в переменной окружения SUPERADMIN_LOGINS (через запятую) — например, в Vercel →
// Settings → Environment Variables. Такой логин становится суперадмином сразу после входа
// на сайт, без правки базы. Обычных админов суперадмин потом назначает прямо в админке
// (/admin/admins) — это уже пишется в базу (User.role).

export type AdminRole = "user" | "admin" | "superadmin";

function envSuperAdminLogins(): Set<string> {
  const raw = process.env.SUPERADMIN_LOGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEnvSuperAdmin(login: string): boolean {
  return envSuperAdminLogins().has(login.toLowerCase());
}

// Итоговая роль: переменная окружения всегда даёт как минимум superadmin, даже если в базе
// у пользователя role="user" (так владелец не может случайно потерять доступ, отредактировав
// свою роль в админке).
export function effectiveRole(user: { login: string; role: string }): AdminRole {
  if (isEnvSuperAdmin(user.login)) return "superadmin";
  return user.role === "admin" || user.role === "superadmin" ? (user.role as AdminRole) : "user";
}

export function isAdminRole(role: AdminRole): boolean {
  return role === "admin" || role === "superadmin";
}
