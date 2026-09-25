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
          ["act_now", "alternatives", "disclaimer", "goal", "main_path", "portrait", "reality_check"].sort(),
        );
        expect(Object.keys(report.main_path).sort()).toEqual(
          ["future_outlook", "learning_advice", "routes", "summary"].sort(),
        );
        expect(report.goal.source).toBe(pathType === "knows_goal" ? "stated" : "constructed");
      });
    }
  }
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
});
