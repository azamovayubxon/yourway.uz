// Схема ответа ИИ для тизера (Приложение Б §4) и проверки «по правилам» (Приложение Б §4, §8).
// Ответ, не прошедший проверку, считается неудачным: генерация повторяется (до 2 раз).

import { z } from "zod";
import { CONTENT_ISSUE_TEXT, findContentIssues, findListIssues } from "./content-checks";
import { findUzIssues, type UzIssueRule, type UzRules } from "./uz-style";

const text = z.string().trim().min(1);

// Схема для API (structured outputs): только форма ответа, без ограничений на длину списков —
// их API не поддерживает. Количество пунктов проверяем ниже, в validateTeaser.
//
// trial_task и free_step — необязательны и здесь, и в TeaserSchema ниже: пока на боевом сайте
// не активирована новая версия промпта (/admin/prompts → «Создать версию из текста в коде» для
// teaser_ru/teaser_uz), действует СТАРЫЙ активный промпт из базы, который эти поля у ИИ не просит.
// Без этой мягкости обычная генерация тизера ломалась бы до нажатия кнопки в админке.
export const TeaserOutputSchema = z.object({
  personality_type_label: z.string(),
  portrait: z.string(),
  top_strengths: z.array(z.string()),
  fitting_directions: z.array(z.object({ title: z.string(), one_liner: z.string(), trial_task: z.string().optional() })),
  free_step: z.string().optional(),
  surprise_hook: z.string(),
  surprise_direction_internal: z.string(),
});

// Строгая схема для проверки на нашей стороне.
// Ограничения длины — с запасом: узбекский текст заметно длиннее русского, и слишком тесные
// рамки браковали нормальные ответы (этап 4б).
export const TeaserSchema = z.object({
  personality_type_label: text.max(80),
  portrait: text.max(1600),
  // Решение владельца (сентябрь 2026, этап B2а): ровно 3 сильные стороны, ровно 3 направления —
  // без слов «5+» и без разброса, который раньше маскировался обрезкой в интерфейсе.
  top_strengths: z.array(text.max(200)).length(3),
  fitting_directions: z
    .array(z.object({ title: text.max(150), one_liner: text.max(400), trial_task: text.max(300).optional() }))
    .length(3),
  // Один полезный бесплатный шаг (аудит UX-13, этап B2а); необязательно — см. комментарий выше.
  free_step: text.max(500).optional(),
  surprise_hook: text.max(700),
  surprise_direction_internal: text.max(200),
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
// trial_task/free_step — необязательны (см. комментарий у схемы выше), поэтому отфильтровываем undefined.
function visibleTexts(t: TeaserContent): string[] {
  return [
    t.personality_type_label,
    t.portrait,
    ...t.top_strengths,
    ...t.fitting_directions.flatMap((d) => [d.title, d.one_liner, d.trial_task]),
    t.free_step,
    t.surprise_hook,
  ].filter((v): v is string => v !== undefined);
}

// Тексты-инсайты: в них не должно быть сумм и цен (правило 5 промпта тизера).
function insightTexts(t: TeaserContent): string[] {
  return visibleTexts(t);
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

// Число предложений в тексте (решение владельца, сентябрь 2026: вывод — строго 2–3 предложения).
// Считает по знакам конца предложения; несколько подряд («…», «?!») — это конец одного предложения,
// а не нескольких.
export function countSentences(value: string): number {
  const matches = value.match(/[^.!?…]+[.!?…]+/gu);
  if (matches) return matches.length;
  return value.trim() ? 1 : 0;
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

  const sentences = countSentences(content.portrait);
  if (sentences < 2 || sentences > 3) {
    found.push({ code: "rule:portrait_sentences", text: `вывод должен быть из 2–3 предложений, сейчас ${sentences}` });
  }

  if (visible.some((v) => PLACEHOLDER.test(v))) {
    found.push({ code: "rule:placeholder", text: "в тексте осталась заглушка вроде «[вставьте …]»" });
  }
  if (insightTexts(content).some((v) => MONEY.test(v))) {
    found.push({ code: "rule:money_in_teaser", text: "в тизере есть суммы денег — их быть не должно" });
  }
  if (!matchesLanguage(visible.join(" "), language)) {
    found.push({ code: `rule:language_not_${language}`, text: `текст не на нужном языке (${language})` });
  }

  // Проверки содержания и тона (этап C1, ТЗ аудита §9–§10): лесть без опоры на данные,
  // гарантии, сравнение «выше/ниже среднего», ссылки, голые коды типов, повторы в списках.
  for (const issue of findContentIssues(visible.join("\n"), language)) {
    found.push({ code: `rule:content_${issue.rule}`, text: CONTENT_ISSUE_TEXT[issue.rule](issue.detail) });
  }
  for (const issue of [
    ...findListIssues("top_strengths", content.top_strengths),
    ...findListIssues("fitting_directions", content.fitting_directions.map((d) => d.title)),
  ]) {
    found.push({ code: `rule:content_${issue.rule}`, text: CONTENT_ISSUE_TEXT[issue.rule](issue.detail) });
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
