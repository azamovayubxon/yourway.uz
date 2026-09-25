import { describe, expect, it } from "vitest";
import { buildProfile, type SurveyAnswerRow } from "./profile";
import type { Answers } from "./scoring";
import { TESTS } from "./tests";

// Полный набор ответов: одно и то же значение на каждый вопрос каждого теста.
function fullAnswers(value: number): Answers {
  const answers: Answers = {};
  for (const test of TESTS) answers[test.id] = Object.fromEntries(test.questions.map((q) => [q.id, value]));
  return answers;
}

const answers = fullAnswers(3);

const knowsGoalRows: SurveyAnswerRow[] = [
  { questionId: "age", value: 19 },
  { questionId: "gender", value: "m" },
  { questionId: "status", value: "student" },
  { questionId: "budget", value: "low" },
  { questionId: "hours", value: "20-40" },
  { questionId: "languages", value: ["uz", "ru", "en"] },
  { questionId: "english_level", value: "basic" },
  { questionId: "relocation", value: "within_country" },
  { questionId: "online_ok", value: "yes" },
  { questionId: "experience", value: "some" },
  { questionId: "skills_text", value: "" }, // пропущено кнопкой «Пропустить»
  { questionId: "interests_text", value: "рисование" },
  { questionId: "goal_text", value: "хочу зарабатывать удалённо" },
  { questionId: "desired_income", value: "10-20m" },
  { questionId: "employment_type", value: "freelance" },
  { questionId: "timeframe", value: "2-3y" },
  { questionId: "risk", value: "medium" },
  { questionId: "lifestyle", value: ["flexible", "remote"] },
];

const goalOnlyIds = ["goal_text", "desired_income", "employment_type", "timeframe", "risk", "lifestyle"];
const noGoalRows = knowsGoalRows.filter((r) => !goalOnlyIds.includes(r.questionId));

describe("сборка профиля (Приложение А §9)", () => {
  it("path_type=knows_goal: level=route, демография и ресурсы разобраны по maps_to, есть блок goal", () => {
    const profile = buildProfile("knows_goal", "ru", answers, knowsGoalRows);
    expect(profile.language).toBe("ru");
    expect(profile.path_type).toBe("knows_goal");
    expect(profile.level).toBe("route");
    expect(profile.demographics).toEqual({ age: 19, gender: "m" });
    expect(profile.resources.status).toBe("student");
    expect(profile.resources.budget_range).toBe("low");
    expect(profile.resources.languages).toEqual(["uz", "ru", "en"]);
    expect(profile.resources.interests_note).toBe("рисование");
    expect(profile.goal).toEqual({
      statement: "хочу зарабатывать удалённо",
      desired_income: "10-20m",
      employment_type: "freelance",
      timeframe: "2-3y",
      risk: "medium",
      lifestyle: ["flexible", "remote"],
    });
  });

  it("пропущенный необязательный вопрос (пустая строка) не попадает в профиль", () => {
    const profile = buildProfile("knows_goal", "ru", answers, knowsGoalRows);
    expect(profile.resources.current_skills).toBeUndefined();
    expect("current_skills" in profile.resources).toBe(false);
  });

  it("path_type=no_goal: level=navigator, блока goal нет вообще (решает ИИ)", () => {
    const profile = buildProfile("no_goal", "ru", answers, noGoalRows);
    expect(profile.level).toBe("navigator");
    expect(profile.goal).toBeUndefined();
    expect("goal" in profile).toBe(false);
  });

  it("решение (Ж): сырые суммы values_scores и learning_style_scores добавлены к профилю", () => {
    const profile = buildProfile("knows_goal", "ru", answers, knowsGoalRows);
    expect(profile.values_scores).toEqual({ money: 6, freedom: 6, stability: 6, recognition: 6, helping: 6, creativity: 6 });
    expect(profile.learning_style_scores).toEqual({ reading: 6, auditory: 6, practice: 6, repetition: 6 });
  });

  it("16-тип: nickname уже на языке профиля (строка, не объект с ru/uz)", () => {
    const profile = buildProfile("knows_goal", "uz", answers, knowsGoalRows);
    expect(typeof profile.sixteen_type.nickname).toBe("string");
    // Все ответы 3 (нейтрально) → 50% по всем шкалам Big Five → все оси в low pole.
    expect(profile.sixteen_type.code).toBe("ISTP");
  });

  it("флаг качества ответов (пункт 3 задачи этапа 3): одинаковые ответы во всех тестах", () => {
    const profile = buildProfile("knows_goal", "ru", answers, knowsGoalRows);
    expect(profile.answer_quality).toEqual({ level: "low", tests: ["big_five", "riasec", "values", "perception"] });
  });

  it("разнообразные ответы — флага качества нет", () => {
    const varied: Answers = {};
    for (const test of TESTS) varied[test.id] = Object.fromEntries(test.questions.map((q) => [q.id, (q.id % 5) + 1]));
    const profile = buildProfile("knows_goal", "ru", varied, knowsGoalRows);
    expect(profile.answer_quality).toBeNull();
  });
});
