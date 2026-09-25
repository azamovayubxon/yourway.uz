import { describe, expect, it } from "vitest";
import { SURVEY_QUESTIONS, SURVEY_SECTIONS, surveyQuestionsFor, surveySectionsFor } from "./survey";

describe("контекстный опрос: разделы и вопросы", () => {
  it("вопрос path_type исключён из опроса (он уже задан на развилке)", () => {
    expect(SURVEY_QUESTIONS.path_type).toBeUndefined();
    for (const s of SURVEY_SECTIONS) {
      expect(s.questions.some((q) => q.id === "path_type"), s.id).toBe(false);
    }
  });

  it("раздел goal_fork (в нём был только path_type) не попадает в разделы опроса", () => {
    expect(SURVEY_SECTIONS.some((s) => s.id === "goal_fork")).toBe(false);
  });

  it("путь «знаю цель»: о вас (3) + ресурсы (9) + цель (6) = 18 вопросов", () => {
    const qs = surveyQuestionsFor("knows_goal");
    expect(qs).toHaveLength(18);
    expect(qs.some((q) => q.id === "goal_text")).toBe(true);
  });

  it("путь «не знаю»: о вас (3) + ресурсы (9) = 12 вопросов, блока цели нет вообще", () => {
    const qs = surveyQuestionsFor("no_goal");
    expect(qs).toHaveLength(12);
    expect(qs.some((q) => q.id.startsWith("goal") || ["desired_income", "employment_type", "timeframe", "risk", "lifestyle"].includes(q.id))).toBe(
      false,
    );
    expect(surveySectionsFor("no_goal").some((s) => s.id === "goal_details")).toBe(false);
  });

  it("обязательные и необязательные вопросы: навыки и увлечения можно пропустить", () => {
    const byId = Object.fromEntries(surveyQuestionsFor("knows_goal").map((q) => [q.id, q]));
    expect(byId.age.required).toBe(true);
    expect(byId.skills_text.required).toBe(false);
    expect(byId.interests_text.required).toBe(false);
    expect(byId.goal_text.required).toBe(true);
  });

  it("возраст: диапазон 10–80 из файла", () => {
    expect(SURVEY_QUESTIONS.age.input).toEqual({ min: 10, max: 80, maxLen: undefined });
  });

  it("вопросы с несколькими ответами (языки, образ жизни) — multi_select", () => {
    expect(SURVEY_QUESTIONS.languages.type).toBe("multi_select");
    expect(SURVEY_QUESTIONS.lifestyle.type).toBe("multi_select");
  });

  it("узбекские тексты исправлены при загрузке (нет обычного апострофа)", () => {
    for (const q of Object.values(SURVEY_QUESTIONS)) {
      expect(q.text.uz, q.id).not.toContain("'");
      for (const o of q.options) expect(o.label.uz, `${q.id}:${o.value}`).not.toContain("'");
    }
    for (const s of SURVEY_SECTIONS) expect(s.title.uz, s.id).not.toContain("'");
  });

  it("maps_to задаёт путь в профиле", () => {
    expect(SURVEY_QUESTIONS.age.mapsTo).toBe("demographics.age");
    expect(SURVEY_QUESTIONS.budget.mapsTo).toBe("resources.budget_range");
    expect(SURVEY_QUESTIONS.goal_text.mapsTo).toBe("goal.statement");
  });
});
