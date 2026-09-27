// Схема ответа ИИ для полного отчёта (Приложение Б §7) и проверки «по правилам» (§8, решения (З), (О), (П)).
// Отчёт пишется по частям (§5а), поэтому схема разбита на три части; каждая проверяется отдельно,
// и при провале повторяется только она.

import { z } from "zod";
import { CONTENT_ISSUE_TEXT, findContentIssues, findListIssues } from "./content-checks";
import type { ReportLevel, ReportPartId, ReportPathType } from "./prompts";
import { matchesLanguage, PLACEHOLDER, UZ_RULE_TEXT, type TeaserLanguage } from "./teaser-schema";
import { findUzIssues, type UzRules } from "./uz-style";

const text = z.string().trim().min(1);

// ── Схемы для API (structured outputs): только форма ответа, без ограничений длины ──

// what_to_check — необязательно и здесь, и в Route ниже: пока на боевом сайте не активирована
// новая версия промпта отчёта (/admin/prompts → «Создать версию из текста в коде» для всех 4
// ключей отчёта), действует СТАРЫЙ активный текст роли в системном промпте, который явно не
// объясняет модели этого поля так подробно, как новый (хотя часть-задача и сама схема, section 6/7,
// уже фиксированы в коде и не зависят от версии в БД — см. комментарий у REPORT_SCHEMA). Без этой
// мягкости старая версия могла бы изредка присылать ответ без поля и ломать генерацию (решение
// владельца, этап C1 — тот же принцип, что у trial_task/free_step в тизере, этап 4б).
const RouteOutput = z.object({
  type: z.enum(["local_cheap", "abroad", "online"]),
  title: z.string(),
  steps: z.array(z.string()),
  time_estimate: z.string(),
  cost_range: z.string(),
  requirements: z.array(z.string()),
  outcome: z.string(),
  effort_level: z.enum(["easy", "hard"]),
  tradeoff_note: z.string(),
  what_to_check: z.string().optional(),
});

export const REPORT_PART_OUTPUT_SCHEMAS = {
  portrait_goal: z.object({
    portrait: z.object({
      type_label: z.string(),
      summary: z.string(),
      strengths: z.array(z.string()),
      watchouts: z.array(z.string()),
    }),
    goal: z.object({
      source: z.enum(["stated", "constructed"]),
      statement: z.string(),
      constructed_options: z.array(z.object({ goal: z.string(), why_fits: z.string() })),
    }),
    reality_check: z.object({
      verdict: z.enum(["fits", "ambitious", "mismatch"]),
      explanation: z.string(),
      adjustment: z.string(),
    }),
  }),
  main_path: z.object({
    // limitations — необязательно (см. комментарий у RouteOutput.what_to_check выше).
    main_path: z.object({ summary: z.string(), limitations: z.array(z.string()).optional(), routes: z.array(RouteOutput) }),
  }),
  finish: z.object({
    main_path: z.object({ learning_advice: z.string(), future_outlook: z.string() }),
    alternatives: z.array(
      z.object({ direction: z.string(), why_you: z.string(), potential: z.string(), first_steps: z.array(z.string()) }),
    ),
    // plan_30_days и takeaway — необязательны (см. комментарий у RouteOutput.what_to_check выше).
    plan_30_days: z.array(z.object({ task: z.string(), expected_result: z.string() })).optional(),
    act_now: z.array(z.string()),
    takeaway: z.string().optional(),
    disclaimer: z.string(),
  }),
} satisfies Record<ReportPartId, z.ZodType>;

// ── Строгие схемы для проверки на нашей стороне ──
// Ограничения длины — с большим запасом (узбекский текст длиннее русского): они ловят только брак
// вроде бесконечного повтора, а не нормальный подробный текст.

const Route = z.object({
  type: z.enum(["local_cheap", "abroad", "online"]),
  title: text.max(200),
  steps: z.array(text.max(1000)).min(2).max(15),
  time_estimate: text.max(400),
  cost_range: text.max(500),
  requirements: z.array(text.max(500)).max(10),
  outcome: text.max(1200),
  effort_level: z.enum(["easy", "hard"]),
  tradeoff_note: text.max(1000),
  // Реальные возможности и источники (ТЗ аудита §9): вместо выдуманных вузов/курсов/цен —
  // что человеку проверить самому и где искать актуальные данные. Необязательно — см. комментарий
  // у RouteOutput выше: со старой активной версией промпта отчёта поля может не быть в ответе,
  // и это не должно ломать генерацию (решение владельца, этап C1).
  what_to_check: text.max(500).optional(),
});

const PortraitGoalSchema = z.object({
  portrait: z.object({
    type_label: text.max(120),
    summary: text.max(4000),
    strengths: z.array(text.max(500)).min(2).max(8),
    watchouts: z.array(text.max(600)).min(1).max(6),
  }),
  goal: z.object({
    source: z.enum(["stated", "constructed"]),
    statement: text.max(800),
    constructed_options: z.array(z.object({ goal: text.max(300), why_fits: text.max(1500) })).max(4),
  }),
  reality_check: z.object({
    verdict: z.enum(["fits", "ambitious", "mismatch"]),
    explanation: text.max(3000),
    // Для verdict = fits может быть пустым; для ambitious/mismatch обязателен (проверка ниже).
    adjustment: z.string().trim().max(3000),
  }),
});

const MainPathSchema = z.object({
  main_path: z.object({
    summary: text.max(1500),
    // Ограничения (ТЗ аудита §9): 2–4 честных пункта — время/бюджет/навыки — для основного
    // маршрута, отдельным полем, а не вырезкой из текста на слое отображения. Необязательно
    // (см. комментарий у RouteOutput.what_to_check выше): без него present.ts подставляет прежнее
    // поведение (ограничения из первого маршрута), как для старых отчётов (report-1.0).
    limitations: z.array(text.max(300)).min(2).max(4).optional(),
    routes: z.array(Route).min(1).max(8),
  }),
});

const FinishSchema = z.object({
  main_path: z.object({ learning_advice: text.max(3000), future_outlook: text.max(3000) }),
  // Слой альтернатив обязателен: 1–2 направления, не больше (§8).
  alternatives: z
    .array(
      z.object({
        direction: text.max(200),
        why_you: text.max(1500),
        potential: text.max(1000),
        first_steps: z.array(text.max(600)).min(1).max(6),
      }),
    )
    .min(1)
    .max(2),
  // План на 30 дней (ТЗ аудита §9): 3–5 задач с понятным результатом каждой. Необязательно
  // (см. комментарий у RouteOutput.what_to_check выше): без него раздел «План на 30 дней» просто
  // не показывается, как для старых отчётов (report-1.0).
  plan_30_days: z
    .array(z.object({ task: text.max(400), expected_result: text.max(400) }))
    .min(3)
    .max(5)
    .optional(),
  act_now: z.array(text.max(600)).min(2).max(7),
  // Краткий вывод всего отчёта (ТЗ аудита §9): отдельное поле, пишется последней частью, когда
  // уже известны и маршрут, и альтернативы — а не вырезка из portrait.summary на слое отображения.
  // Необязательно (см. комментарий у RouteOutput.what_to_check выше): present.ts подставляет
  // прежнюю вырезку из portrait.summary, если поля нет.
  takeaway: text.max(1200).optional(),
  disclaimer: text.max(800),
});

export const REPORT_PART_SCHEMAS = {
  portrait_goal: PortraitGoalSchema,
  main_path: MainPathSchema,
  finish: FinishSchema,
} satisfies Record<ReportPartId, z.ZodType>;

export type PortraitGoalPart = z.infer<typeof PortraitGoalSchema>;
export type MainPathPart = z.infer<typeof MainPathSchema>;
export type FinishPart = z.infer<typeof FinishSchema>;
export type ReportRoute = z.infer<typeof Route>;

// Собранный отчёт — схема Приложения Б §7 (report-2.0, этап C1). takeaway, main_path.limitations,
// main_path.routes[].what_to_check и plan_30_days — необязательны уже в самой zod-схеме выше:
// со старой активной версией промпта (пока владелец не нажал «Создать версию из текста в коде»
// для всех 4 ключей отчёта) модель может их не вернуть, и это не должно ронять генерацию. По той
// же причине в БД остаются и старые отчёты (report-1.0), где этих полей нет вообще (ТЗ аудита §15:
// «старые отчёты отображаются как раньше», миграция схемы не требуется).
export type ReportContent = PortraitGoalPart & {
  main_path: MainPathPart["main_path"] & FinishPart["main_path"];
  alternatives: FinishPart["alternatives"];
  act_now: FinishPart["act_now"];
  plan_30_days?: FinishPart["plan_30_days"];
  takeaway?: string;
  disclaimer: string;
};

// Склеивает готовые части в один отчёт (main_path собирается из частей 2 и 3).
export function mergeReportParts(parts: {
  portrait_goal: PortraitGoalPart;
  main_path: MainPathPart;
  finish: FinishPart;
}): ReportContent {
  return {
    portrait: parts.portrait_goal.portrait,
    goal: parts.portrait_goal.goal,
    reality_check: parts.portrait_goal.reality_check,
    main_path: { ...parts.main_path.main_path, ...parts.finish.main_path },
    alternatives: parts.finish.alternatives,
    act_now: parts.finish.act_now,
    plan_30_days: parts.finish.plan_30_days,
    takeaway: parts.finish.takeaway,
    disclaimer: parts.finish.disclaimer,
  };
}

// content и softOnly присутствуют и при ok:false — это позволяет вызывающему коду (report/index.ts)
// принять последнюю попытку как есть, если все найденные нарушения «мягкие» (тон/содержание —
// решение владельца, этап C1: оплативший пользователь не должен получить ошибку из-за слова
// «уникальный»). content — undefined только когда сама схема не разобралась (parsed.success = false):
// в этом случае принимать ответ не из чего.
export type PartValidation =
  | { ok: true; content: unknown; error: null; problems: []; softOnly: false }
  | { ok: false; error: string; problems: string[]; content?: unknown; softOnly: boolean };

// «Мягкие» нарушения (этап C1, уточнение по ревью) — тон и содержание: лесть без опоры на данные,
// гарантии, сравнение «выше/ниже среднего», ссылка в тексте, голый код типа, пустой/повторяющийся
// пункт списка, а также английское слово-жаргонизм в узбекском тексте (rule:uz_english — «deadline»,
// «feedback» вместо «muddat», «fikr-mulohaza»; см. docs/uz-glossary.md, раздел «Запрещённые
// английские слова»). Названия инструментов, технологий и платформ (Figma, Python, Excel, Canva,
// Telegram, Behance, UX/UI и т. п.) в этот список не входят и вообще не считаются нарушением —
// см. тот же раздел глоссария. Мягкие нарушения можно принять на последней попытке вместо провала
// генерации оплаченного отчёта. Жёсткие — разрыв схемы (`schema:...`), обязательные поля по типу
// пути, отсутствие пометки «ориентировочно», заглушки, язык не тот, обращение на «ты», а также
// остальные узбекские нарушения из uz-style.ts (кириллица, «sen», «Tu», запрещённые конструкции —
// это не отдельное слово, а неверная грамматика или калька) — по-прежнему всегда бракуют ответ.
function isSoftIssueCode(code: string): boolean {
  return code.startsWith("rule:content_") || code.startsWith("rule:uz_english");
}

// Служебные коды схемы (online, easy, stated, fits…) — не текст для человека: их не проверяем
// на язык и стоп-слова (иначе код «online» считался бы английским словом в узбекском тексте).
const CODE_FIELDS = new Set(["type", "effort_level", "source", "verdict"]);

// Все строки ответа, которые увидит человек (для проверки языка, заглушек, обращения).
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => (CODE_FIELDS.has(key) ? [] : allStrings(child)));
  }
  return [];
}

// Пометка «ориентировочно» у сроков и сумм (§5, правило 2; §8 — эвристическая проверка).
// Русский: «ориентировочно», «примерно», «около»; узбекский: «taxminan», «taxminiy», «tahminan».
const APPROX = /ориентировоч|примерн|около|taxmin|tahmin/i;

// Обращение на «ты» в русском тексте (решение (О)): только «вы».
const TY_WORDS =
  /(?<![а-яё])(ты|тебе|тебя|тобой|твой|твоя|твои|твоё|твое|твоих|твоим|твоей|твою|твоего|твоему|твоими)(?![а-яё])/i;

export function validateReportPart(
  part: ReportPartId,
  raw: unknown,
  ctx: { language: TeaserLanguage; pathType: ReportPathType; level: ReportLevel; uzRules?: Partial<UzRules> },
): PartValidation {
  const parsed = REPORT_PART_SCHEMAS[part].safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `schema:${issue.path.join(".")}:${issue.code}`,
      problems: parsed.error.issues.slice(0, 10).map((i) => `поле ${i.path.join(".") || "(ответ)"}: ${i.message}`),
      softOnly: false,
    };
  }
  const content = parsed.data;
  const found: { code: string; text: string }[] = [];
  const strings = allStrings(content);

  if (part === "portrait_goal") {
    const { goal, reality_check } = content as PortraitGoalPart;
    // Решение (З): обязательные поля по типу пути.
    if (ctx.pathType === "knows_goal" && goal.source !== "stated") {
      found.push({ code: "rule:goal_source", text: 'у человека своя цель: goal.source должно быть "stated"' });
    }
    if (ctx.pathType === "no_goal") {
      if (goal.source !== "constructed") {
        found.push({ code: "rule:goal_source", text: 'цель подобрана вами: goal.source должно быть "constructed"' });
      }
      if (goal.constructed_options.length < 2 || goal.constructed_options.length > 3) {
        found.push({ code: "rule:constructed_options", text: "в goal.constructed_options должно быть 2–3 варианта цели" });
      }
    }
    if (reality_check.verdict !== "fits" && !reality_check.adjustment) {
      found.push({
        code: "rule:adjustment",
        text: "reality_check.adjustment пустое: при ambitious/mismatch нужно написать, как скорректировать цель",
      });
    }
  }

  if (part === "main_path") {
    const { routes } = (content as MainPathPart).main_path;
    routes.forEach((route, i) => {
      for (const field of ["time_estimate", "cost_range"] as const) {
        if (!APPROX.test(route[field])) {
          found.push({
            code: `rule:approx:${field}`,
            text: `main_path.routes.${i}.${field}: нет пометки «ориентировочно» — сроки и суммы только диапазоном и с этой пометкой`,
          });
        }
      }
    });
  }

  if (strings.some((v) => PLACEHOLDER.test(v))) {
    found.push({ code: "rule:placeholder", text: "в тексте осталась заглушка вроде «[вставьте …]»" });
  }
  const joined = strings.join("\n");
  if (!matchesLanguage(joined, ctx.language)) {
    found.push({ code: `rule:language_not_${ctx.language}`, text: `текст не на нужном языке (${ctx.language})` });
  }
  if (ctx.language === "ru") {
    const ty = joined.match(TY_WORDS);
    if (ty) found.push({ code: "rule:ty", text: `обращение на «ты» («${ty[0]}») — нужно только «вы»` });
  }
  // Узбекский: нет кириллицы, «Tu», форм на «sen», английских слов и запрещённых конструкций (решение (П)).
  if (ctx.language === "uz") {
    for (const issue of findUzIssues(joined, ctx.uzRules)) {
      found.push({ code: `rule:uz_${issue.rule}:${issue.word}`, text: `${UZ_RULE_TEXT[issue.rule]}: «${issue.word}»` });
    }
  }

  // Проверки содержания и тона (этап C1, ТЗ аудита §9–§10): лесть без опоры на данные, гарантии,
  // «выше/ниже среднего», ссылки на несуществующие источники, голые коды типов, пустые и
  // повторяющиеся пункты списков.
  for (const issue of findContentIssues(joined, ctx.language)) {
    found.push({ code: `rule:content_${issue.rule}`, text: CONTENT_ISSUE_TEXT[issue.rule](issue.detail) });
  }
  const listChecks: [string, readonly string[]][] =
    part === "portrait_goal"
      ? [
          ["portrait.strengths", (content as PortraitGoalPart).portrait.strengths],
          ["portrait.watchouts", (content as PortraitGoalPart).portrait.watchouts],
        ]
      : part === "finish"
        ? [
            ["act_now", (content as FinishPart).act_now],
            ["plan_30_days", ((content as FinishPart).plan_30_days ?? []).map((p) => p.task)],
            ["alternatives", (content as FinishPart).alternatives.map((a) => a.direction)],
          ]
        : [];
  for (const [label, items] of listChecks) {
    for (const issue of findListIssues(label, items)) {
      found.push({ code: `rule:content_${issue.rule}`, text: CONTENT_ISSUE_TEXT[issue.rule](issue.detail) });
    }
  }

  if (found.length > 0) {
    return {
      ok: false,
      error: found[0].code,
      problems: [...new Set(found.map((f) => f.text))],
      content,
      softOnly: found.every((f) => isSoftIssueCode(f.code)),
    };
  }
  return { ok: true, content, error: null, problems: [], softOnly: false };
}
