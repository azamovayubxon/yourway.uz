import "server-only";
import { getDb } from "@/lib/db";
import { logError } from "@/lib/monitoring";

// Цены уровней полного отчёта. Отдельный файл, чтобы лендинг и страница цен не тянули за собой
// модули оплаты и ИИ.

export const LEVELS = ["route", "navigator"] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

// Цены уровней из базы (таблица Price), в сумах. Уровня без цены в базе нет в продаже.
export async function getPrices(): Promise<Partial<Record<Level, number>>> {
  const rows = await getDb().price.findMany();
  const prices: Partial<Record<Level, number>> = {};
  for (const row of rows) if (isLevel(row.level) && row.amount >= 0) prices[row.level] = row.amount;
  return prices;
}

// То же, но без падения страницы, если база недоступна (для лендинга и страницы цен):
// тогда показываются цены из словаря.
export async function getPricesSafe(): Promise<Partial<Record<Level, number>>> {
  try {
    return await getPrices();
  } catch (error) {
    await logError("payments-prices", error);
    return {};
  }
}

