import { describe, expect, it } from "vitest";
import { MOCK_TEASERS } from "@/lib/ai/mock-teasers";
import { generateShareCode, isShareCode, readStrengths, SHARE_CODE_LENGTH, shareSnapshot } from "./code";

describe("код ссылки «Поделиться»", () => {
  it("12 знаков без двусмысленных букв и цифр", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateShareCode();
      expect(code).toHaveLength(SHARE_CODE_LENGTH);
      expect(code).not.toMatch(/[01ilo]/);
      expect(isShareCode(code)).toBe(true);
    }
  });

  it("коды не повторяются", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateShareCode));
    expect(codes.size).toBe(1000);
  });

  it("isShareCode отбрасывает всё лишнее", () => {
    expect(isShareCode("abc")).toBe(false);
    expect(isShareCode("ABCDEFGHJKMN")).toBe(false);
    expect(isShareCode("abcdefghjkm0")).toBe(false);
    expect(isShareCode("abcdefghjkmn'")).toBe(false);
    expect(isShareCode(null)).toBe(false);
    expect(isShareCode("abcdefghjkmn")).toBe(true);
  });
});

describe("shareSnapshot: на открытую страницу — только тип и три сильные стороны", () => {
  it.each(["ru", "uz"] as const)("[%s] нет портрета, направлений, шага и загадки", (locale) => {
    const content = MOCK_TEASERS[locale];
    const snapshot = shareSnapshot(content);
    expect(Object.keys(snapshot).sort()).toEqual(["strengths", "typeLabel"]);
    expect(snapshot.typeLabel).toBe(content.personality_type_label);
    expect(snapshot.strengths).toEqual(content.top_strengths);
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain(content.portrait.slice(0, 30));
    for (const d of content.fitting_directions) expect(json).not.toContain(d.title);
    expect(json).not.toContain(content.surprise_direction_internal);
  });

  it("не больше трёх сильных сторон", () => {
    expect(shareSnapshot({ personality_type_label: "X", top_strengths: ["a", "b", "c", "d"] }).strengths).toEqual(["a", "b", "c"]);
  });

  it("readStrengths читает JSON из базы осторожно", () => {
    expect(readStrengths(["a", 1, "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(readStrengths("a")).toEqual([]);
  });
});
