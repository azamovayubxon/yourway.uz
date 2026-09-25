import "dotenv/config";
import { defineConfig } from "prisma/config";

// Настройки Prisma CLI (генерация клиента и миграции).
// Для миграций нужна «прямая» строка подключения без пулера:
// у Neon это DATABASE_URL_UNPOOLED. Если её нет, берём DATABASE_URL.
// Заглушка нужна только для `prisma generate`, который к базе не подключается.
const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  "postgresql://user:password@localhost:5432/yourway";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
