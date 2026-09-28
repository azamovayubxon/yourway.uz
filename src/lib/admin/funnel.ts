import "server-only";
import { getDb } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import type { Locale } from "@/i18n/config";
import { ru } from "@/i18n/dictionaries/ru";
import { SOON_DIRECTIONS, SOON_EVENT_PREFIX, soonEvent, type SoonDirection } from "@/lib/directions";

// Аналитика воронки (этап 8): заход → старт теста → конец теста → тизер → регистрация → оплата → PDF,
// с разбивкой по языкам. Считаем прямо по существующим таблицам — отдельный журнал событий
// (FunnelEvent) нужен только для двух шагов, для которых своей таблицы нет: заход на сайт и
// скачивание PDF (см. logVisit/logPdfDownload и schema.prisma).

export type FunnelStepKey = "visit" | "testStart" | "testDone" | "teaser" | "register" | "payment" | "pdf";

export interface FunnelRow {
  key: FunnelStepKey;
  label: string;
  byLocale: Partial<Record<Locale, number>>;
  total: number;
}

function toByLocale(rows: { locale: string; _count: { _all: number } }[]): {
  byLocale: Partial<Record<Locale, number>>;
  total: number;
} {
  const byLocale: Partial<Record<Locale, number>> = {};
  let total = 0;
  for (const r of rows) {
    if (r.locale === "uz" || r.locale === "ru") byLocale[r.locale] = r._count._all;
    total += r._count._all;
  }
  return { byLocale, total };
}

export async function getFunnel(): Promise<FunnelRow[]> {
  const db = getDb();
  const [visit, testStart, testDone, teaser, register, payment, pdf] = await Promise.all([
    db.funnelEvent.groupBy({ by: ["locale"], where: { event: "visit" }, _count: { _all: true } }),
    db.testSession.groupBy({ by: ["locale"], _count: { _all: true } }),
    db.testSession.groupBy({ by: ["locale"], where: { testsDoneAt: { not: null } }, _count: { _all: true } }),
    db.teaser.groupBy({ by: ["locale"], where: { status: "ready" }, _count: { _all: true } }),
    db.user.groupBy({ by: ["locale"], _count: { _all: true } }),
    db.payment.groupBy({ by: ["locale"], where: { status: "paid" }, _count: { _all: true } }),
    db.funnelEvent.groupBy({ by: ["locale"], where: { event: "pdf" }, _count: { _all: true } }),
  ]);

  const steps: { key: FunnelStepKey; label: string; rows: { locale: string; _count: { _all: number } }[] }[] = [
    { key: "visit", label: "Заход на сайт", rows: visit },
    { key: "testStart", label: "Начали тесты", rows: testStart },
    { key: "testDone", label: "Закончили тесты", rows: testDone },
    { key: "teaser", label: "Получили тизер", rows: teaser },
    { key: "register", label: "Зарегистрировались", rows: register },
    { key: "payment", label: "Оплатили отчёт", rows: payment },
    { key: "pdf", label: "Скачали PDF", rows: pdf },
  ];

  return steps.map(({ key, label, rows }) => ({ key, label, ...toByLocale(rows) }));
}

// Дедупликация "захода": не больше одного события на посетителя в сутки — по cookie yw_seen,
// которую ставит сама logVisit (см. вызов в src/app/page.tsx).
export async function logVisit(locale: Locale, sessionId: string | null): Promise<void> {
  try {
    await getDb().funnelEvent.create({ data: { event: "visit", locale, sessionId } });
  } catch (e) {
    // Аналитика не должна ронять страницу, если база временно недоступна.
    void logError("funnel-visit", e);
  }
}

export async function logPdfDownload(locale: Locale, sessionId: string | null): Promise<void> {
  try {
    await getDb().funnelEvent.create({ data: { event: "pdf", locale, sessionId } });
  } catch (e) {
    void logError("funnel-pdf", e);
  }
}

// Интерес к направлениям «Скоро» (главная, src/components/landing/DirectionsGrid.tsx): событие
// soon:<id> в том же журнале FunnelEvent — без отдельной таблицы и миграции. Дедупликация (не
// больше одного нажатия на одно направление от посетителя в сутки) — в /api/soon, по cookie.
export async function logSoonClick(id: SoonDirection, locale: Locale, sessionId: string | null): Promise<void> {
  try {
    await getDb().funnelEvent.create({ data: { event: soonEvent(id), locale, sessionId } });
  } catch (e) {
    void logError("funnel-soon", e);
  }
}

export interface SoonInterestRow {
  id: SoonDirection;
  label: string;
  last7: number;
  last30: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Таблица «Интерес к направлениям» в /admin/analytics: все направления (и с нулём тоже), по убыванию
// числа нажатий за всё время; при равенстве — за 30 и за 7 дней.
export async function getSoonInterest(now = new Date()): Promise<SoonInterestRow[]> {
  const db = getDb();
  const count = (since?: Date) =>
    db.funnelEvent.groupBy({
      by: ["event"],
      where: { event: { startsWith: SOON_EVENT_PREFIX }, ...(since ? { createdAt: { gte: since } } : {}) },
      _count: { _all: true },
    });
  const [last7, last30, total] = await Promise.all([
    count(new Date(now.getTime() - 7 * DAY_MS)),
    count(new Date(now.getTime() - 30 * DAY_MS)),
    count(),
  ]);
  const toMap = (rows: { event: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.event, r._count._all]));
  const [m7, m30, mAll] = [toMap(last7), toMap(last30), toMap(total)];

  return SOON_DIRECTIONS.map((id) => ({
    id,
    label: ru.landing.directions.soon[id].title,
    last7: m7.get(soonEvent(id)) ?? 0,
    last30: m30.get(soonEvent(id)) ?? 0,
    total: mAll.get(soonEvent(id)) ?? 0,
  })).sort((a, b) => b.total - a.total || b.last30 - a.last30 || b.last7 - a.last7);
}
