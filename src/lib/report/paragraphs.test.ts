import { describe, expect, it } from "vitest";
import { splitIntoParagraphs } from "./paragraphs";

describe("splitIntoParagraphs — разбивка длинных абзацев при отображении (ТЗ аудита §9)", () => {
  it("короткий текст остаётся одним абзацем", () => {
    expect(splitIntoParagraphs("Короткая мысль в одно предложение.")).toEqual([
      "Короткая мысль в одно предложение.",
    ]);
  });

  it("уважает переносы строк, которые уже расставил ИИ", () => {
    const text = "Первый абзац.\n\nВторой абзац.";
    expect(splitIntoParagraphs(text)).toEqual(["Первый абзац.", "Второй абзац."]);
  });

  it("длинный блок делится по границам предложений, не разрывая мысль", () => {
    const sentence = "Слово ".repeat(20).trim() + ".";
    const text = [sentence, sentence, sentence, sentence].join(" ");
    const result = splitIntoParagraphs(text, 40);
    expect(result.length).toBeGreaterThan(1);
    // Ни одно предложение не потеряно и не изменено — только перегруппировано.
    expect(result.join(" ")).toBe(text);
    for (const p of result) expect(p.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(41);
  });

  it("блок из одного длинного предложения без границ не режется искусственно", () => {
    const oneSentence = "Слово ".repeat(100).trim() + ".";
    expect(splitIntoParagraphs(oneSentence, 40)).toEqual([oneSentence]);
  });
});
