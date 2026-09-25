// Схема ответа ИИ для тизера (Приложение Б §4) и проверки «по правилам» (Приложение Б §4, §8).
// Ответ, не прошедший проверку, считается неудачным: генерация повторяется (до 2 раз).

import { z } from "zod";
import { findUzIssues, type UzIssueRule, type UzRules } from "./uz-style";

const text = z.string().trim().min(1);

// Схема для API (structured outputs): только форма ответа, без ограничений на длину списков —
// их API не поддерживает. Количество пунктов проверяем ниже, в validateTeaser.
export const TeaserOutputSchema = z.object({
  personality_type_label: z.string(),
  portrait: z.string(),
  top_strengths: z.array(z.string()),
  fitting_directions: z.array(z.object({ title: z.string(), one_liner: z.string() })),
  surprise_hook: z.string(),
  surprise_direction_internal: z.string(),
  locked_toc: z.array(z.string()),
});

// Строгая схема для проверки на нашей стороне.
// Ограничения длины — с запасом: узбекский текст заметно длиннее русского, и слишком тесные
// рамки браковали нормальные ответы (этап 4б).
export const TeaserSchema = z.object({
  personality_type_label: text.max(80),
  portrait: text.max(1600),
  // Промпт просит 3 сильные стороны, ТЗ 3.7.1 — 2–3. Принимаем 2–4, показываем первые 3.
  top_strengths: z.array(text.max(200)).min(2).max(4),
  // Промпт: 2–3 сферы. Небольшой запас (4), на экране — первые 3.
  fitting_directions: z
    .array(z.object({ title: text.max(150), one_liner: text.max(400) }))
    .min(2)
    .max(4),
  surprise_hook: text.max(700),
  surprise_direction_internal: text.max(200),
  // Промпт просит 8–12 пунктов. Проверка мягкая (решение (Г)): 7 пунктов из golden example тоже принимаются.
  locked_toc: z.array(text.max(200)).min(5).max(15),
});

export type TeaserContent = z.infer<typeof TeaserSchema>;

export type TeaserLanguage = "ru" | "uz";

// error — короткий код первой проблемы (для журнала и статистики);
// problems — все найденные проблемы понятным текстом: они показываются в /dev/ai-log
// и передаются ИИ при повторной попытке, чтобы он исправил именно их.
export type ValidationResult =
  | { ok: true; content: TeaserContent }
  | { ok: false; error: string; problems: string[] };

// Поля, которые видит пользователь (surprise_direction_internal — нет, оно только для Вызова 2).
function visibleTexts(t: TeaserContent): string[] {
  return [
    t.personality_type_label,
    t.portrait,
    ...t.top_strengths,
    ...t.fitting_directions.flatMap((d) => [d.title, d.one_liner]),
    t.surprise_hook,
    ...t.locked_toc,
  ];
}

// Тексты-инсайты: в них не должно быть сумм и цен (правило 5 промпта тизера).
// В оглавлении цифры допустимы: там может быть цель человека («маршруты к цели $2000+»).
function insightTexts(t: TeaserContent): string[] {
  return [
    t.personality_type_label,
    t.portrait,
    ...t.top_strengths,
    ...t.fitting_directions.flatMap((d) => [d.title, d.one_liner]),
    t.surprise_hook,
  ];
}

// Недописанные заглушки вроде «[вставьте ...]», «{{...}}», «TODO», «...» вместо текста.
export const PLACEHOLDER = /\[[^\]]*(встав|insert|todo|placeholder)[^\]]*\]|\{\{|\bTODO\b|\blorem ipsum\b/i;

// Суммы денег: «$2000», «2000$», «5 млн сум», «10 000 so'm», «USD».
const MONEY = /[$€₽]\s?\d|\d\s?[$€₽]|\d[\d\s.,]*\s?(сум|so[ʻ'’`]?m|млн|тыс|mln|ming|usd|долл|dollar)|\busd\b/i;

// Доля кириллических букв среди всех букв текста.
export function cyrillicShare(value: string): number {
  const letters = value.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  const cyr = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
  return cyr / letters.length;
}

// Проверка языка: русский текст — в основном кириллица (английские термины вроде «UX» допускаются).
// Узбекский (латиница) — без единой кириллической буквы (этап 4б).
export function matchesLanguage(value: string, language: TeaserLanguage): boolean {
  const share = cyrillicShare(value);
  return language === "ru" ? share >= 0.6 : share === 0;
}

// uzRules — стоп-слова и запрещённые конструкции из глоссария (для узбекского ответа).
export const UZ_RULE_TEXT: Record<UzIssueRule, string> = {
  cyrillic: "кириллица в узбекском тексте",
  tu: "слово «Tu» — нужно «Siz»",
  sen: "обращение на «sen» — нужна форма на «siz»",
  english: "английское слово — нужно узбекское",
  phrase: "запрещённая конструкция — перефразируйте",
};

export function validateTeaser(raw: unknown, language: TeaserLanguage, uzRules?: Partial<UzRules>): ValidationResult {
  const parsed = TeaserSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `schema:${issue.path.join(".")}:${issue.code}`,
      problems: parsed.error.issues.map((i) => `поле ${i.path.join(".") || "(ответ)"}: ${i.message}`),
    };
  }
  const content = parsed.data;
  const visible = visibleTexts(content);
  const found: { code: string; text: string }[] = [];

  if (visible.some((v) => PLACEHOLDER.test(v))) {
    found.push({ code: "rule:placeholder", text: "в тексте осталась заглушка вроде «[вставьте …]»" });
  }
  if (insightTexts(content).some((v) => MONEY.test(v))) {
    found.push({ code: "rule:money_in_teaser", text: "в тизере есть суммы денег — их быть не должно" });
  }
  if (!matchesLanguage(visible.join(" "), language)) {
    found.push({ code: `rule:language_not_${language}`, text: `текст не на нужном языке (${language})` });
  }

  // Узбекский: нет кириллицы, «Tu», форм на «sen», английских слов и запрещённых конструкций.
  // Проверяем и скрытое поле surprise_direction_internal: оно уйдёт в полный отчёт.
  if (language === "uz") {
    for (const issue of findUzIssues([...visible, content.surprise_direction_internal].join("\n"), uzRules)) {
      found.push({ code: `rule:uz_${issue.rule}:${issue.word}`, text: `${UZ_RULE_TEXT[issue.rule]}: «${issue.word}»` });
    }
  }

  if (found.length > 0) {
    return { ok: false, error: found[0].code, problems: [...new Set(found.map((f) => f.text))] };
  }
  return { ok: true, content };
}

// Достаёт JSON из ответа модели. Обычно ответ — чистый JSON (structured outputs), но на всякий
// случай снимаем обёртку ```json ... ``` и лишний текст вокруг фигурных скобок.
export function extractJson(textValue: string): unknown {
  const trimmed = textValue
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new SyntaxError("В ответе ИИ нет JSON");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
