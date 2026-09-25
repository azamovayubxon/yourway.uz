import "server-only";
import { getDb } from "@/lib/db";
import { reportModel, teaserModel } from "@/lib/ai/config";
import type { Level } from "@/lib/payments/prices";
import type { Locale } from "@/i18n/config";

// Ручной выбор модели ИИ по уровню и языку (этап 8). Переопределение хранится в таблице
// ModelOverride и имеет приоритет над переменными окружения (src/lib/ai/config.ts), но не заменяет
// их насовсем: очистив поле в админке, снова получаем значение по умолчанию из окружения.

export type ModelOverrideKey = "teaser_ru" | "teaser_uz" | "report_route" | "report_navigator";

export const MODEL_OVERRIDE_KEYS: ModelOverrideKey[] = ["teaser_ru", "teaser_uz", "report_route", "report_navigator"];

export function defaultModelFor(key: ModelOverrideKey): string {
  if (key === "teaser_ru") return teaserModel("ru");
  if (key === "teaser_uz") return teaserModel("uz");
  if (key === "report_route") return reportModel("route");
  return reportModel("navigator");
}

export interface ModelOverrideRow {
  key: ModelOverrideKey;
  override: string | null;
  effective: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export async function listModelOverrides(): Promise<ModelOverrideRow[]> {
  const rows = await getDb().modelOverride.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return MODEL_OVERRIDE_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      override: row?.model ?? null,
      effective: row?.model || defaultModelFor(key),
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function setModelOverride(key: ModelOverrideKey, model: string, updatedBy: string): Promise<void> {
  const value = model.trim();
  const db = getDb();
  if (!value) {
    await db.modelOverride.deleteMany({ where: { key } });
    return;
  }
  await db.modelOverride.upsert({
    where: { key },
    create: { key, model: value, updatedBy },
    update: { model: value, updatedBy },
  });
}

async function overrideOrDefault(key: ModelOverrideKey, fallback: string): Promise<string> {
  const row = await getDb().modelOverride.findUnique({ where: { key } });
  return row?.model || fallback;
}

// Используются при самой генерации (src/lib/teaser, src/lib/report) вместо teaserModel/reportModel
// напрямую — с тем же поведением по умолчанию, если override не задан.
export async function resolveTeaserModel(locale: Locale): Promise<string> {
  return overrideOrDefault(locale === "uz" ? "teaser_uz" : "teaser_ru", teaserModel(locale));
}

export async function resolveReportModel(level: Level): Promise<string> {
  return overrideOrDefault(level === "navigator" ? "report_navigator" : "report_route", reportModel(level));
}
