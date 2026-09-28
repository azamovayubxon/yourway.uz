// Направления платформы на главной (CLAUDE.md, раздел «Главная и карточки „Скоро“»).
// Работает одно — «Путь профессии» (текущий продукт). Остальные — карточки «Скоро»: нажатие на
// карточку пишет в журнал FunnelEvent событие `soon:<id>` (счётчик интереса в /admin/analytics).
// Порядок массива — порядок карточек на главной. Тексты — в словарях, раздел landing.directions.soon
// (ключи совпадают с id; это проверяет тест src/lib/directions.test.ts).

export const SOON_DIRECTIONS = [
  "university",
  "parents",
  "abroad",
  "language",
  "exam",
  "online",
  "business",
  "sport",
  "hobby",
  "money",
  "people",
] as const;

export type SoonDirection = (typeof SOON_DIRECTIONS)[number];

export function isSoonDirection(value: unknown): value is SoonDirection {
  return typeof value === "string" && (SOON_DIRECTIONS as readonly string[]).includes(value);
}

export const SOON_EVENT_PREFIX = "soon:";

export function soonEvent(id: SoonDirection): string {
  return `${SOON_EVENT_PREFIX}${id}`;
}
