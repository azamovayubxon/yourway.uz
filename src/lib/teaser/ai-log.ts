// Сводка для служебной страницы /dev/ai-log: сколько в среднем длится тизер на каждом языке.
// Длительность тизера = сумма всех его попыток (первая + повтор, если был).

export interface CallForSummary {
  teaserId: string | null;
  locale: string | null;
  durationMs: number;
  ok: boolean;
  createdAt: Date;
}

export interface LocaleSummary {
  locale: string;
  teasers: number;
  ok: number;
  avgMs: number;
  maxMs: number;
  // Сколько тизеров понадобилось повторять.
  retried: number;
}

// calls — вызовы в любом порядке; берутся последние perLocale тизеров каждого языка.
export function summarizeTeaserDurations(calls: CallForSummary[], perLocale = 20): LocaleSummary[] {
  const teasers = new Map<string, { locale: string; totalMs: number; ok: boolean; attempts: number; last: number }>();
  for (const call of calls) {
    if (!call.teaserId || !call.locale) continue;
    const t = teasers.get(call.teaserId) ?? { locale: call.locale, totalMs: 0, ok: false, attempts: 0, last: 0 };
    t.totalMs += call.durationMs;
    t.ok ||= call.ok;
    t.attempts += 1;
    t.last = Math.max(t.last, call.createdAt.getTime());
    teasers.set(call.teaserId, t);
  }
  const byLocale = new Map<string, (typeof teasers extends Map<string, infer V> ? V : never)[]>();
  for (const t of teasers.values()) byLocale.set(t.locale, [...(byLocale.get(t.locale) ?? []), t]);

  return [...byLocale.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locale, list]) => {
      const recent = list.sort((a, b) => b.last - a.last).slice(0, perLocale);
      const total = recent.reduce((sum, t) => sum + t.totalMs, 0);
      return {
        locale,
        teasers: recent.length,
        ok: recent.filter((t) => t.ok).length,
        avgMs: Math.round(total / recent.length),
        maxMs: Math.max(...recent.map((t) => t.totalMs)),
        retried: recent.filter((t) => t.attempts > 1).length,
      };
    });
}
