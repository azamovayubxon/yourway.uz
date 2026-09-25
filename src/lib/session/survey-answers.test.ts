import { describe, expect, it } from "vitest";
import { isValidSurveyAnswer } from "./survey-answers";

describe("проверка ответа опроса из браузера", () => {
  it("число в диапазоне принимается, вне диапазона и не целое — нет", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 19 })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 10 })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 80 })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 9 })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 81 })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: 25.5 })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "age", value: "19" })).toBe(false);
  });

  it("single_select: только известные значения из options", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "gender", value: "m" })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "gender", value: "unknown" })).toBe(false);
  });

  it("multi_select: обязательный — минимум один вариант, без повторов, только известные значения", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "languages", value: ["uz", "ru"] })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "languages", value: [] })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "languages", value: ["uz", "uz"] })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "languages", value: ["klingon"] })).toBe(false);
  });

  it("text: обязательный не может быть пустым, необязательный — может (пропуск)", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "моя цель" })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "" })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "   " })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "skills_text", value: "" })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "skills_text", value: "html/css" })).toBe(true);
  });

  it("текст длиннее max_len отклоняется", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "x".repeat(300) })).toBe(true);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "x".repeat(301) })).toBe(false);
  });

  it("вопросы блока «Цель» недоступны на пути no_goal", () => {
    expect(isValidSurveyAnswer("no_goal", { questionId: "goal_text", value: "моя цель" })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "goal_text", value: "моя цель" })).toBe(true);
  });

  it("path_type и неизвестные вопросы отклоняются", () => {
    expect(isValidSurveyAnswer("knows_goal", { questionId: "path_type", value: "knows_goal" })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: "unknown_question", value: "x" })).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", null)).toBe(false);
    expect(isValidSurveyAnswer("knows_goal", { questionId: 5, value: "x" })).toBe(false);
  });
});
