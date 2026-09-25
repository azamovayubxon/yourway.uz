// Применение миграций базы данных во время сборки на Vercel (`npm run vercel-build`).
//
// Зачем отдельный скрипт, а не просто `prisma migrate deploy`:
// 1. Пока в проекте нет ни одной миграции (папка prisma/migrations пустая или её нет),
//    к базе во время сборки подключаться не нужно. Шаг пропускается, и сборка не зависит от базы.
// 2. Если миграции есть, но база недоступна, скрипт пишет в лог понятную причину:
//    какие переменные заданы и к какому серверу идёт подключение (без пароля).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

const migrationsDir = "prisma/migrations";
const hasMigrations =
  existsSync(migrationsDir) &&
  readdirSync(migrationsDir, { withFileTypes: true }).some((entry) => entry.isDirectory());

if (!hasMigrations) {
  console.log("[migrate] Миграций пока нет — шаг пропущен, к базе не подключаемся.");
  process.exit(0);
}

// Показываем адрес базы без логина и пароля.
function describe(name) {
  const value = process.env[name];
  if (!value) return `${name}: не задана`;
  try {
    const url = new URL(value);
    return `${name}: задана (сервер ${url.hostname}, база ${url.pathname.slice(1) || "?"})`;
  } catch {
    return `${name}: задана, но это не похоже на адрес базы (ожидается postgresql://...)`;
  }
}

console.log("[migrate] " + describe("DATABASE_URL_UNPOOLED"));
console.log("[migrate] " + describe("DATABASE_URL"));

if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.error(
    "[migrate] ОШИБКА: не задана строка подключения к базе. " +
      "В Vercel: Settings → Environment Variables, нужна DATABASE_URL (и желательно DATABASE_URL_UNPOOLED) " +
      "для того окружения, которое собирается (Production или Preview).",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) {
  console.error("[migrate] ОШИБКА: миграции не применились. Причина — в строках выше (код вида P1001, P1000 и т. п.).");
}
process.exit(result.status ?? 1);
