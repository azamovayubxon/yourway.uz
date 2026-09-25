// Заблокированное оглавление полного отчёта (решение (Г)): 8–12 личных пунктов от ИИ
// плюс общие разделы полного отчёта из словаря интерфейса, всего 20+ пунктов.

export interface TocItem {
  text: string;
  // personal — пункт от ИИ (на языке тизера); general — общий раздел (на языке интерфейса).
  kind: "personal" | "general";
}

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

// Сначала личные пункты (они интригуют сильнее), потом общие. Точные повторы убираем.
export function buildLockedToc(personal: string[], general: string[]): TocItem[] {
  const seen = new Set<string>();
  const items: TocItem[] = [];
  for (const [kind, list] of [
    ["personal", personal],
    ["general", general],
  ] as const) {
    for (const text of list) {
      const key = normalize(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({ text: text.trim(), kind });
    }
  }
  return items;
}
