import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  nextVersionNumber,
  pickActiveVersion,
  PROMPT_DEFAULTS,
  validatePromptTemplates,
  type PromptKey,
} from "./prompt-registry";

export { promptVersionLabel, parsePromptVersionLabel } from "./prompt-registry";

// Хранение версий промптов в БД (этап 8б). Версия 1 на каждый ключ создаётся автоматически из
// текста в коде при первом обращении (требование 1 этапа 8б) — отдельного скрипта-сеятеля не нужно.
// Чистая логика выбора активной версии/номера следующей версии — в prompt-registry.ts (покрыта
// тестами без БД); здесь только Prisma-обвязка вокруг неё.

export interface PromptVersionRow {
  id: string;
  key: string;
  version: number;
  systemTemplate: string;
  userTemplate: string;
  comment: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: Date;
  activatedBy: string | null;
  activatedAt: Date | null;
}

async function ensureSeeded(key: PromptKey): Promise<void> {
  const db = getDb();
  const exists = await db.promptVersion.findFirst({ where: { key }, select: { id: true } });
  if (exists) return;
  const def = PROMPT_DEFAULTS[key];
  try {
    await db.promptVersion.create({
      data: {
        key,
        version: 1,
        systemTemplate: def.system.template,
        userTemplate: def.user.template,
        comment: null,
        active: true,
        createdBy: null,
        activatedBy: null,
        activatedAt: null,
      },
    });
  } catch (error) {
    // Гонка: версию 1 уже создал параллельный запрос (unique [key, version]) — это ожидаемо.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}

// Активная версия для генерации (требование 3): если в БД активной версии нет — берём текст из кода,
// не как строку в БД, а как запасной вариант прямо здесь (на случай, если сеятель не успел отработать
// или строку деактивировали вручную и не выбрали новую активную).
export async function getActivePromptVersion(key: PromptKey): Promise<PromptVersionRow> {
  await ensureSeeded(key);
  const versions = await getDb().promptVersion.findMany({ where: { key } });
  const row = pickActiveVersion(versions);
  if (row) return row;
  const def = PROMPT_DEFAULTS[key];
  return {
    id: "code",
    key,
    version: 0,
    systemTemplate: def.system.template,
    userTemplate: def.user.template,
    comment: null,
    active: true,
    createdBy: null,
    createdAt: new Date(0),
    activatedBy: null,
    activatedAt: null,
  };
}

// Конкретная версия по ключу и номеру (для отчёта: все части генерируются той же версией промпта,
// что была активна на момент оплаты, — даже если пока шла генерация владелец сохранил новую).
export async function getPromptVersionByNumber(key: PromptKey, version: number): Promise<PromptVersionRow | null> {
  if (version <= 0) {
    const def = PROMPT_DEFAULTS[key];
    return {
      id: "code",
      key,
      version: 0,
      systemTemplate: def.system.template,
      userTemplate: def.user.template,
      comment: null,
      active: false,
      createdBy: null,
      createdAt: new Date(0),
      activatedBy: null,
      activatedAt: null,
    };
  }
  return getDb().promptVersion.findFirst({ where: { key, version } });
}

export async function listPromptVersions(key: PromptKey): Promise<PromptVersionRow[]> {
  await ensureSeeded(key);
  return getDb().promptVersion.findMany({ where: { key }, orderBy: { version: "desc" } });
}

export type SaveResult = { ok: true; version: number } | { ok: false; errors: string[] };

// Сохраняет новый черновик как следующую версию (требование 2). activate — сделать её активной сразу
// (обычное сохранение из формы редактирования); при false версия только добавляется в историю.
export async function createPromptVersion(options: {
  key: PromptKey;
  systemTemplate: string;
  userTemplate: string;
  comment: string;
  createdBy: string;
  activate: boolean;
}): Promise<SaveResult> {
  const errors = validatePromptTemplates(options.key, options.systemTemplate, options.userTemplate);
  if (errors.length > 0) return { ok: false, errors };

  await ensureSeeded(options.key);
  const db = getDb();
  const version = await db.$transaction(async (tx) => {
    const existing = await tx.promptVersion.findMany({ where: { key: options.key }, select: { version: true } });
    const nextVersion = nextVersionNumber(existing);
    if (options.activate) {
      await tx.promptVersion.updateMany({ where: { key: options.key, active: true }, data: { active: false } });
    }
    await tx.promptVersion.create({
      data: {
        key: options.key,
        version: nextVersion,
        systemTemplate: options.systemTemplate,
        userTemplate: options.userTemplate,
        comment: options.comment.trim() || null,
        active: options.activate,
        createdBy: options.createdBy,
        activatedBy: options.activate ? options.createdBy : null,
        activatedAt: options.activate ? new Date() : null,
      },
    });
    return nextVersion;
  });
  return { ok: true, version };
}

// Откат: делает уже существующую версию активной (требование 2, кнопка «сделать активной»).
export async function activatePromptVersion(key: PromptKey, versionId: string, activatedBy: string): Promise<boolean> {
  const db = getDb();
  const target = await db.promptVersion.findUnique({ where: { id: versionId } });
  if (!target || target.key !== key) return false;
  if (target.active) return true;
  await db.$transaction([
    db.promptVersion.updateMany({ where: { key, active: true }, data: { active: false } }),
    db.promptVersion.update({ where: { id: versionId }, data: { active: true, activatedBy, activatedAt: new Date() } }),
  ]);
  return true;
}
