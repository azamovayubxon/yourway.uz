import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/assessment/profile";
import { MOCK_REPORTS } from "./mock-reports";
import { MOCK_TEASERS } from "./mock-teasers";
import {
  buildReportPartPrompt,
  buildReportRetryFeedback,
  buildReportSystem,
  NO_PREVIOUS_PARTS,
  PART_TASK_FINISH,
  PART_TASK_MAIN_PATH,
  PART_TASK_PORTRAIT_GOAL,
  PATH_RULE_KNOWS_GOAL,
  PATH_RULE_NO_GOAL_NAVIGATOR,
  PATH_RULE_NO_GOAL_ROUTE,
  PHILOSOPHY_BLOCK,
  PROFILE_GUIDE,
  REPORT_PART_TEMPLATE,
  REPORT_PARTS,
  REPORT_RETRY_TEMPLATE,
  REPORT_SCHEMA,
  REPORT_SYSTEM_LAYOUT,
  REPORT_SYSTEM_TEMPLATE,
  REPORT_USER_TEMPLATE,
  TONE_RULES_BLOCK,
} from "./prompts";
import { createMockProvider, ZERO_USAGE, type AiProvider, type AiRequest } from "./providers";
import { runReportPartAttempt } from "./report";
import { mergeReportParts, validateReportPart, type PortraitGoalPart } from "./report-schema";

const doc = readFileSync(path.resolve(import.meta.dirname, "../../../docs/prilozhenie-b-prompty.md"), "utf8");
const codeBlocks = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ""));

const profile = {
  language: "ru",
  path_type: "knows_goal",
  level: "route",
  demographics: { age: 19, gender: "m" },
  big_five: { openness: 88 },
  sixteen_type: { code: "ENTP", nickname: "Новатор" },
  learning_style: "practice",
} as unknown as Profile;

describe("промпты полного отчёта (Приложение Б §5–§7, §5а)", () => {
  it("перенесены из документа дословно", () => {
    for (const text of [
      REPORT_SYSTEM_TEMPLATE,
      REPORT_USER_TEMPLATE,
      PROFILE_GUIDE,
      REPORT_SCHEMA,
      REPORT_SYSTEM_LAYOUT,
      REPORT_PART_TEMPLATE,
      PART_TASK_PORTRAIT_GOAL,
      PART_TASK_MAIN_PATH,
      PART_TASK_FINISH,
      PATH_RULE_KNOWS_GOAL,
      PATH_RULE_NO_GOAL_NAVIGATOR,
      PATH_RULE_NO_GOAL_ROUTE,
      REPORT_RETRY_TEMPLATE,
    ]) {
      expect(codeBlocks).toContain(text);
    }
    expect(doc).toContain("`" + NO_PREVIOUS_PARTS + "`");
  });

  it("системная часть собрана из §5, §6, §7 и одинакова для всех частей, уровней и путей (кэшируется)", () => {
    const system = buildReportSystem("ru");
    expect(system.startsWith(PHILOSOPHY_BLOCK)).toBe(true);
    expect(system).toContain(TONE_RULES_BLOCK);
    expect(system).toContain("Вы пишете ПОЛНЫЙ платный отчёт");
    expect(system).toContain("КАК ЧИТАТЬ ПРОФИЛЬ:");
    expect(system).toContain("СХЕМА ВЫВОДА (Вызов 2):\n{\n  \"portrait\"");
    expect(system).toContain("строго на языке: ru");
    expect(system).not.toMatch(/\{\{\w+\}\}|\[БЛОК|\[СИСТЕМНЫЙ|\[СПРАВОЧНИК|\[СХЕМА ИЗ/);
    const variants = REPORT_PARTS.flatMap((part) =>
      (["route", "navigator"] as const).map(
        (level) =>
          buildReportPartPrompt({ profile, teaser: {}, language: "ru", level, pathType: "no_goal", part, previousParts: {} })
            .system,
      ),
    );
    expect(new Set(variants).size).toBe(1);
  });

  it("узбекский отчёт получает блок правил на узбекском (глоссарий, стоп-слова, эталоны)", () => {
    const uz = buildReportSystem("uz");
    expect(uz).toContain("OʻZBEK TILIDA YOZISH QOIDALARI");
    expect(uz).toContain("«A nuqta»");
    expect(uz).toContain("строго на языке: uz");
    expect(buildReportSystem("ru")).not.toContain("OʻZBEK TILIDA");
  });

  it("сообщение части: профиль, тизер, уровень, путь, поля части и готовые части", () => {
    const first = buildReportPartPrompt({
      profile,
      teaser: { personality_type_label: "X" },
      language: "ru",
      level: "navigator",
      pathType: "no_goal",
      part: "portrait_goal",
      previousParts: {},
    }).user;
    expect(first).toContain("Уровень: navigator | Тип пути: no_goal | Язык: ru");
    expect(first).toContain("ЧАСТЬ ОТЧЁТА 1 ИЗ 3.");
    expect(first).toContain("portrait, goal, reality_check");
    expect(first).toContain(PATH_RULE_NO_GOAL_NAVIGATOR);
    expect(first).toContain(NO_PREVIOUS_PARTS);
    expect(first).toContain('"personality_type_label": "X"');
    expect(first).not.toMatch(/\{\{\w+\}\}/);

    const second = buildReportPartPrompt({
      profile,
      teaser: {},
      language: "ru",
      level: "route",
      pathType: "no_goal",
      part: "main_path",
      previousParts: { portrait_goal: { goal: { statement: "Цель-123" } } },
    }).user;
    expect(second).toContain("ЧАСТЬ ОТЧЁТА 2 ИЗ 3.");
    expect(second).toContain("Цель-123");
    expect(second).not.toContain("Тип пути no_goal");
  });

  it("правило по типу пути для части 1 (решения (В) и (З))", () => {
    const rule = (pathType: "knows_goal" | "no_goal", level: "route" | "navigator") =>
      buildReportPartPrompt({ profile, teaser: {}, language: "ru", level, pathType, part: "portrait_goal", previousParts: {} })
        .user;
    expect(rule("knows_goal", "navigator")).toContain(PATH_RULE_KNOWS_GOAL);
    expect(rule("no_goal", "route")).toContain(PATH_RULE_NO_GOAL_ROUTE);
    expect(rule("no_goal", "navigator")).toContain(PATH_RULE_NO_GOAL_NAVIGATOR);
  });

  // UX-18 (этап B2а): без своей цели человек выбрал «Маршрут» и указал цель на checkout —
  // profile.goal.statement уже заполнено. С ней работаем как с обычной stated-целью.
  it("no_goal + route + цель, выбранная на checkout (UX-18): правило как для stated", () => {
    const withGoal = { ...profile, goal: { statement: "Стать веб-дизайнером" } };
    const prompt = buildReportPartPrompt({
      profile: withGoal,
      teaser: {},
      language: "ru",
      level: "route",
      pathType: "no_goal",
      part: "portrait_goal",
      previousParts: {},
    });
    expect(prompt.user).toContain(PATH_RULE_KNOWS_GOAL);
    expect(prompt.user).not.toContain(PATH_RULE_NO_GOAL_ROUTE);
  });

  it("подсказка для повтора перечисляет проблемы", () => {
    expect(buildReportRetryFeedback(["a", "b"])).toContain("- a\n- b");
  });
});

const TY = /(?<![а-яё])(ты|тебе|тебя|твой|твоя|твои)(?![а-яё])/i;

describe("обращение на «вы» в промптах отчёта", () => {
  it("нет «ты»", () => {
    for (const text of [REPORT_SYSTEM_TEMPLATE, REPORT_USER_TEMPLATE, PROFILE_GUIDE, REPORT_PART_TEMPLATE, PART_TASK_FINISH]) {
      expect(text).not.toMatch(TY);
    }
  });
});

describe("тестовый режим: образец отчёта проходит все проверки", () => {
  for (const locale of ["ru", "uz"] as const) {
    for (const pathType of ["knows_goal", "no_goal"] as const) {
      it(`${locale}, ${pathType}`, async () => {
        const parts: Record<string, unknown> = {};
        for (const part of REPORT_PARTS) {
          const result = await runReportPartAttempt({
            part,
            profile,
            teaser: MOCK_TEASERS[locale],
            locale,
            level: pathType === "knows_goal" ? "route" : "navigator",
            pathType,
            previousParts: parts,
            model: "mock",
            provider: createMockProvider(0),
          });
          expect(result.problems, `${part}`).toEqual([]);
          parts[part] = result.content;
        }
        const report = mergeReportParts(parts as Parameters<typeof mergeReportParts>[0]);
        expect(Object.keys(report).sort()).toEqual(
          [
            "act_now",
            "alternatives",
            "disclaimer",
            "goal",
            "main_path",
            "plan_30_days",
            "portrait",
            "reality_check",
            "takeaway",
          ].sort(),
        );
        expect(Object.keys(report.main_path).sort()).toEqual(
          ["future_outlook", "learning_advice", "limitations", "routes", "summary"].sort(),
        );
        expect(report.goal.source).toBe(pathType === "knows_goal" ? "stated" : "constructed");
      });
    }
  }
});

// UX-18: то же самое, но end-to-end через runReportPartAttempt (мок-режим должен пройти этот путь
// целиком — CLAUDE.md §3, воронка без ключа) для человека без своей цели, который выбрал «Маршрут»
// и указал цель на checkout.
describe("no_goal + route + цель с checkout (UX-18): мок-режим проходит проверку", () => {
  it("goal.source получается stated, а не constructed", async () => {
    const withGoal = { ...profile, path_type: "no_goal" as const, goal: { statement: "Стать веб-дизайнером" } };
    const result = await runReportPartAttempt({
      part: "portrait_goal",
      profile: withGoal,
      teaser: MOCK_TEASERS.ru,
      locale: "ru",
      level: "route",
      pathType: "no_goal",
      previousParts: {},
      model: "mock",
      provider: createMockProvider(0),
    });
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect((result.content as PortraitGoalPart).goal.source).toBe("stated");
  });
});

const ctx = { language: "ru" as const, pathType: "knows_goal" as const, level: "route" as const };
const ruPortrait = (): PortraitGoalPart => ({
  portrait: MOCK_REPORTS.ru.portrait,
  goal: MOCK_REPORTS.ru.goal.stated,
  reality_check: MOCK_REPORTS.ru.reality_check.stated,
});

describe("проверка частей отчёта (Приложение Б §8, решения (З), (О), (П))", () => {
  it("knows_goal: цель должна быть stated", () => {
    const bad = { ...ruPortrait(), goal: MOCK_REPORTS.ru.goal.constructed };
    const result = validateReportPart("portrait_goal", bad, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rule:goal_source");
  });

  it("no_goal: 2–3 подобранные цели", () => {
    const one = { ...MOCK_REPORTS.ru.goal.constructed, constructed_options: MOCK_REPORTS.ru.goal.constructed.constructed_options.slice(0, 1) };
    const result = validateReportPart(
      "portrait_goal",
      { ...ruPortrait(), goal: one, reality_check: MOCK_REPORTS.ru.reality_check.constructed },
      { ...ctx, pathType: "no_goal" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join()).toContain("2–3");
  });

  it("ambitious без adjustment — брак", () => {
    const bad = { ...ruPortrait(), reality_check: { ...MOCK_REPORTS.ru.reality_check.stated, adjustment: "" } };
    expect(validateReportPart("portrait_goal", bad, ctx).ok).toBe(false);
  });

  it("сроки и суммы без «ориентировочно» — брак", () => {
    const part = structuredClone(MOCK_REPORTS.ru.main_path);
    part.main_path.routes[1].cost_range = "$300–900 за курс";
    const result = validateReportPart("main_path", part, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("routes.1.cost_range");
  });

  it("альтернатив не больше двух и хотя бы одна", () => {
    const three = structuredClone(MOCK_REPORTS.ru.finish);
    three.alternatives = [three.alternatives[0], three.alternatives[0], three.alternatives[0]];
    expect(validateReportPart("finish", three, ctx).ok).toBe(false);
    const none = { ...structuredClone(MOCK_REPORTS.ru.finish), alternatives: [] };
    expect(validateReportPart("finish", none, ctx).ok).toBe(false);
  });

  it("русский текст: обращение на «ты» — брак", () => {
    const part = structuredClone(MOCK_REPORTS.ru.finish);
    part.act_now[0] = "Установи Figma и найди свой первый заказ — твой путь начинается";
    const result = validateReportPart("finish", part, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rule:ty");
  });

  it("узбекский текст: «sen», английские слова и кириллица — брак", () => {
    const part = structuredClone(MOCK_REPORTS.uz.finish);
    part.act_now[0] = "Bugun business rejangizni yozing, sen bilasan";
    part.disclaimer = "Tavsiyalar ma'lumot uchun. Решение за вами.";
    const result = validateReportPart("finish", part, {
      ...ctx,
      language: "uz",
      uzRules: { stopWords: ["business"], forbiddenPhrases: [] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const all = result.problems.join("\n");
      expect(all).toContain("business");
      expect(all).toContain("sen");
      expect(all).toContain("кириллица");
    }
  });

  it("старая версия промпта (без takeaway/limitations/what_to_check/plan_30_days) — не брак (этап C1)", () => {
    // Симулируем ответ ИИ по старой активной версии промпта (report-1.0): полей report-2.0 в нём
    // просто нет. Решение владельца: генерация не должна ломаться, пока владелец не пересоздаст
    // версии промптов отчёта в /admin/prompts.
    const oldMainPath = structuredClone(MOCK_REPORTS.ru.main_path);
    delete (oldMainPath.main_path as { limitations?: unknown }).limitations;
    for (const route of oldMainPath.main_path.routes) delete (route as { what_to_check?: unknown }).what_to_check;
    const mainPathResult = validateReportPart("main_path", oldMainPath, ctx);
    expect(mainPathResult.ok).toBe(true);

    const oldFinish = structuredClone(MOCK_REPORTS.ru.finish);
    delete (oldFinish as { takeaway?: unknown }).takeaway;
    delete (oldFinish as { plan_30_days?: unknown }).plan_30_days;
    const finishResult = validateReportPart("finish", oldFinish, ctx);
    expect(finishResult.ok).toBe(true);
  });

  it("нарушение только тона (например, «уникальный») — softOnly, содержимое сохраняется", () => {
    const part = structuredClone(MOCK_REPORTS.ru.finish);
    part.act_now[0] = "Это уникальное сочетание качеств поможет вам начать";
    const result = validateReportPart("finish", part, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.softOnly).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.error).toBe("rule:content_forbidden_phrase");
    }
  });

  it("нарушение схемы (не хватает обязательного поля) — НЕ softOnly, даже если рядом есть тон-нарушение", () => {
    const part = structuredClone(MOCK_REPORTS.ru.finish);
    part.act_now[0] = "Это уникальное сочетание качеств поможет вам начать";
    delete (part as { disclaimer?: unknown }).disclaimer; // обязательное поле схемы
    const result = validateReportPart("finish", part, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.startsWith("schema:")).toBe(true);
  });

  it("нарушение обращения на «ты» рядом с тон-нарушением — НЕ softOnly (языковая корректность важнее)", () => {
    const part = structuredClone(MOCK_REPORTS.ru.finish);
    part.act_now[0] = "Это уникальное сочетание качеств — твой путь начинается";
    const result = validateReportPart("finish", part, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.softOnly).toBe(false);
  });

  it("служебные коды (online, easy, stated) не считаются английскими словами", () => {
    const result = validateReportPart("main_path", MOCK_REPORTS.uz.main_path, {
      ...ctx,
      language: "uz",
      uzRules: { stopWords: ["online", "easy", "hard"], forbiddenPhrases: [] },
    });
    expect(result.ok).toBe(true);
  });
});

function scriptedProvider(responses: { text: string; finish?: "complete" | "truncated" }[]) {
  const requests: AiRequest[] = [];
  const provider: AiProvider = {
    name: "scripted",
    estimateCostUsd: () => 0,
    async call(request) {
      requests.push(request);
      const next = responses.shift()!;
      return { text: next.text, finish: next.finish ?? "complete", usage: ZERO_USAGE };
    },
  };
  return { provider, requests };
}

describe("одна попытка части", () => {
  const base = {
    part: "finish" as const,
    profile,
    teaser: MOCK_TEASERS.ru,
    locale: "ru" as const,
    level: "route" as const,
    pathType: "knows_goal" as const,
    previousParts: {},
    model: "claude-sonnet-5",
  };

  it("обрезанный ответ — брак с понятной подсказкой", async () => {
    const { provider } = scriptedProvider([{ text: "{", finish: "truncated" }]);
    const result = await runReportPartAttempt({ ...base, provider });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("finish:truncated");
  });

  it("не-JSON — брак", async () => {
    const { provider } = scriptedProvider([{ text: "не json" }]);
    const result = await runReportPartAttempt({ ...base, provider });
    expect(result.error).toBe("json:invalid");
  });

  it("повтор получает прошлый ответ и список проблем; параметры — из настроек уровня", async () => {
    const { provider, requests } = scriptedProvider([{ text: JSON.stringify(MOCK_REPORTS.ru.finish) }]);
    const result = await runReportPartAttempt({
      ...base,
      provider,
      level: "navigator",
      retry: { previousResponse: "старый ответ", problems: ["нет пометки «ориентировочно»"] },
    });
    expect(result.ok).toBe(true);
    expect(requests[0].retry?.previousResponse).toBe("старый ответ");
    expect(requests[0].retry?.feedback).toContain("- нет пометки «ориентировочно»");
    expect(requests[0].tag).toBe("report:finish:knows_goal");
    expect(requests[0].effort).toBe("medium");
    expect(requests[0].timeoutMs).toBeLessThan(300_000);
    expect(requests[0].user).toContain("Уровень: navigator");
  });

  it("нарушение только тона — content и softOnly доходят до вызывающего кода (этап C1)", async () => {
    const bad = structuredClone(MOCK_REPORTS.ru.finish);
    bad.act_now[0] = "Это уникальное сочетание качеств поможет вам начать";
    const { provider } = scriptedProvider([{ text: JSON.stringify(bad) }]);
    const result = await runReportPartAttempt({ ...base, provider });
    expect(result.ok).toBe(false);
    expect(result.softOnly).toBe(true);
    expect(result.content).toBeDefined();
  });
});
