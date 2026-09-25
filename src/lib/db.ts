import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Один клиент базы на весь процесс. В режиме разработки Next.js
// перезагружает модули, поэтому клиент храним в globalThis, чтобы не плодить подключения.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан. См. .env.example");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}
