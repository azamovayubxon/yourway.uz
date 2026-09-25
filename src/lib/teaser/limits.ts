// Лимиты на генерацию тизера (решение (К)): тизер бесплатный, но каждый вызов ИИ стоит денег.
//
// В одной сессии тизер хранится по одному на язык. Первый тизер тратит лимит TEASER_LIMIT_PER_SESSION,
// тизер на другом языке — лимит TEASER_LANG_REGEN_PER_SESSION (решение (Л)). Повтор после сбоя
// генерации не тратит лимит сессии, но считается в мягком лимите по IP.

import type { TeaserLimits } from "@/lib/ai/config";

export type LimitReason = "session" | "ip";

export type LimitDecision = { ok: true } | { ok: false; reason: LimitReason };

export function checkTeaserLimits(input: {
  // Сколько тизеров этой сессии уже есть (готовых или генерирующихся) на ДРУГИХ языках.
  otherLocaleTeasers: number;
  // Сколько генераций тизера запущено с этого IP за последние 24 часа.
  ipGenerationsLast24h: number;
  limits: TeaserLimits;
}): LimitDecision {
  const { otherLocaleTeasers, ipGenerationsLast24h, limits } = input;
  const sessionAllowance =
    otherLocaleTeasers === 0 ? limits.perSession : limits.perSession + limits.langRegenPerSession;
  if (otherLocaleTeasers >= sessionAllowance) return { ok: false, reason: "session" };
  if (ipGenerationsLast24h >= limits.perIpPerDay) return { ok: false, reason: "ip" };
  return { ok: true };
}
