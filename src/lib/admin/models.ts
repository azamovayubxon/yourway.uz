import "server-only";
import { getDb } from "@/lib/db";
import { reportModel, teaserModel } from "@/lib/ai/config";
import { isOpenAiModel } from "@/lib/ai/providers";
import type { Level } from "@/lib/payments/prices";
import type { Locale } from "@/i18n/config";

// Ручной выбор модели ИИ по уровню и языку (этап 8). Переопределение хранится в таблице
// ModelOverride и имеет приоритет над переменными окружения (src/lib/ai/config.ts), но не заменяет
// их насовсем: очистив поле в админке, снова получаем значение по умолчанию из окружения.

//
// Отчёт на узбекском можно отдать отдельной модели (report_route_uz, report_navigator_uz), например
// модели OpenAI, оставив русский на Claude. Пустое значение = как раньше: модель уровня
// (report_route / report_navigator, а если и они пусты — переменная окружения).

export type ModelOverrideKey =
  | "teaser_ru"
  | "teaser_uz"
  | "report_route"
  | "report_navigator"
  | "report_route_uz"
  | "report_navigator_uz";

export const MODEL_OVERRIDE_KEYS: ModelOverrideKey[] = [
  "teaser_ru",
  "teaser_uz",
  "report_route",
  "report_navigator",
  "report_route_uz",
  "report_navigator_uz",
];

// Узбекский ключ отчёта → ключ уровня, модель которого берётся, если узбекский пуст.
const UZ_REPORT_PARENT: Partial<Record<ModelOverrideKey, "report_route" | "report_navigator">> = {
  report_route_uz: "report_route",
  report_navigator_uz: "report_navigator",
};

export function defaultModelFor(key: ModelOverrideKey): string {
  if (key === "teaser_ru") return teaserModel("ru");
  if (key === "teaser_uz") return teaserModel("uz");
  if (key === "report_route" || key === "report_route_uz") return reportModel("route");
  return reportModel("navigator");
}

// Какую модель вернуть по переопределениям (без базы — для тестов): сначала сам ключ, для узбекского
// отчёта — затем ключ уровня, и в конце значение по умолчанию из окружения.
export function pickModel(key: ModelOverrideKey, overrides: Partial<Record<ModelOverrideKey, string | null>>): string {
  const own = overrides[key]?.trim();
  if (own) return own;
  const parent = UZ_REPORT_PARENT[key];
  if (parent) return pickModel(parent, overrides);
  return defaultModelFor(key);
}

export function reportModelKey(level: Level, locale: Locale): ModelOverrideKey {
  if (locale === "uz") return level === "navigator" ? "report_navigator_uz" : "report_route_uz";
  return level === "navigator" ? "report_navigator" : "report_route";
}

// Модель OpenAI нельзя выбрать, если в окружении нет OPENAI_API_KEY: иначе каждая генерация шла бы
// через страховку на Claude (дольше и дороже), а владелец не понимал бы почему.
export function modelSaveError(model: string, hasOpenAiKey: boolean): string | null {
  const value = model.trim();
  if (!value) return null;
  if (!/^[A-Za-z0-9._:-]{2,80}$/.test(value)) return "bad_name";
  if (isOpenAiModel(value) && !hasOpenAiKey) return "openai_key";
  return null;
}

export interface ModelOverrideRow {
  key: ModelOverrideKey;
  override: string | null;
  effective: string;
  updatedBy: string | null;
  updatedAt: Date | null;
}

async function loadOverrides(): Promise<Partial<Record<ModelOverrideKey, string>>> {
  const rows = await getDb().modelOverride.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.model]));
}

export async function listModelOverrides(): Promise<ModelOverrideRow[]> {
  const rows = await getDb().modelOverride.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const overrides = Object.fromEntries(rows.map((r) => [r.key, r.model]));
  return MODEL_OVERRIDE_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      override: row?.model ?? null,
      effective: pickModel(key, overrides),
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

// Используются при самой генерации (src/lib/teaser, src/lib/report) вместо teaserModel/reportModel
// напрямую — с тем же поведением по умолчанию, если override не задан.
export async function resolveTeaserModel(locale: Locale): Promise<string> {
  return pickModel(locale === "uz" ? "teaser_uz" : "teaser_ru", await loadOverrides());
}

// Модель отчёта по уровню и языку отчёта: для узбекского — свой ключ, если задан (см. выше).
export async function resolveReportModel(level: Level, locale: Locale): Promise<string> {
  return pickModel(reportModelKey(level, locale), await loadOverrides());
}
