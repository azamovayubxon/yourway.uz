import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import { generateShareCode, isShareCode, readStrengths, shareSnapshot } from "./code";

// «Поделиться» и «Сохранить картинку» на странице бесплатного результата (этап 2б).
// Открытая карточка создаётся только нажатием кнопки и только для тизера ТЕКУЩЕЙ сессии
// (владение проверяется по cookie сессии, как в /api/teaser). Одна карточка на тизер: повторное
// нажатие возвращает тот же код. Удаляется каскадом вместе с тизером (сессией, аккаунтом).

export { isShareCode } from "./code";

// Готовый тизер этой сессии с таким id (или null — чужой, не готов, не существует).
export async function getOwnedReadyTeaser(sessionId: string, teaserId: unknown) {
  if (typeof teaserId !== "string" || !/^[0-9a-f-]{36}$/i.test(teaserId)) return null;
  const teaser = await getDb().teaser.findFirst({
    where: { id: teaserId, sessionId, status: "ready" },
    select: { id: true, locale: true, content: true },
  });
  return teaser?.content ? { ...teaser, content: teaser.content as unknown as TeaserContent } : null;
}

export async function getOrCreateShareCard(teaser: { id: string; locale: string; content: TeaserContent }): Promise<string> {
  const db = getDb();
  const existing = await db.shareCard.findUnique({ where: { teaserId: teaser.id }, select: { code: true } });
  if (existing) return existing.code;
  const snapshot = shareSnapshot(teaser.content);
  for (let attempt = 0; ; attempt++) {
    try {
      const card = await db.shareCard.create({
        data: {
          code: generateShareCode(),
          teaserId: teaser.id,
          locale: teaser.locale,
          typeLabel: snapshot.typeLabel,
          strengths: snapshot.strengths,
        },
        select: { code: true },
      });
      return card.code;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002" || attempt >= 3) throw e;
      // Два нажатия одновременно: карточку уже создал соседний запрос — отдаём её код.
      const raced = await db.shareCard.findUnique({ where: { teaserId: teaser.id }, select: { code: true } });
      if (raced) return raced.code;
      // Иначе совпал случайный код (почти невозможно) — пробуем другой.
    }
  }
}

export interface PublicShareCard {
  code: string;
  locale: "uz" | "ru";
  typeLabel: string;
  strengths: string[];
}

// Открытая карточка по коду — только то, что можно показывать всем.
export async function getShareCard(code: string): Promise<PublicShareCard | null> {
  if (!isShareCode(code)) return null;
  const card = await getDb().shareCard.findUnique({
    where: { code },
    select: { code: true, locale: true, typeLabel: true, strengths: true },
  });
  if (!card) return null;
  return {
    code: card.code,
    locale: card.locale === "ru" ? "ru" : "uz",
    typeLabel: card.typeLabel,
    strengths: readStrengths(card.strengths),
  };
}
