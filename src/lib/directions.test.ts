import { describe, expect, it } from "vitest";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";
import { isSoonDirection, SOON_DIRECTIONS, soonEvent } from "./directions";

describe("направления «Скоро»", () => {
  it("у каждого id есть тексты в обоих словарях, лишних ключей нет", () => {
    expect(Object.keys(ru.landing.directions.soon).sort()).toEqual([...SOON_DIRECTIONS].sort());
    expect(Object.keys(uz.landing.directions.soon).sort()).toEqual([...SOON_DIRECTIONS].sort());
  });

  it("принимает только известные id (защита эндпоинта /api/soon)", () => {
    expect(isSoonDirection("parents")).toBe(true);
    expect(isSoonDirection("career")).toBe(false);
    expect(isSoonDirection("soon:parents")).toBe(false);
    expect(isSoonDirection(undefined)).toBe(false);
    expect(isSoonDirection(1)).toBe(false);
  });

  it("событие аналитики — soon:<id>", () => {
    expect(soonEvent("money")).toBe("soon:money");
  });
});
