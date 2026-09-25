import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTeaserPrompt,
  fillTemplate,
  LANGUAGE_LINE,
  PHILOSOPHY_BLOCK,
  TEASER_SYSTEM_TEMPLATE,
  TEASER_USER_TEMPLATE,
} from "./prompts";

// Промпты должны совпадать с Приложением Б дословно (CLAUDE.md §7).
const doc = readFileSync(path.resolve(import.meta.dirname, "../../../docs/prilozhenie-b-prompty.md"), "utf8");
const codeBlocks = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ""));

describe("промпты тизера (Приложение Б)", () => {
  it("перенесены из документа дословно", () => {
    expect(codeBlocks).toContain(PHILOSOPHY_BLOCK);
    expect(codeBlocks).toContain(TEASER_SYSTEM_TEMPLATE);
    expect(codeBlocks).toContain(TEASER_USER_TEMPLATE);
    expect(doc).toContain("`" + LANGUAGE_LINE + "`");
  });

  it("подставляют философию, язык и профиль; плейсхолдеров не остаётся", () => {
    const profile = { language: "uz", big_five: { openness: 88 } };
    const { system, user } = buildTeaserPrompt(profile, "uz");
    expect(system.startsWith(PHILOSOPHY_BLOCK)).toBe(true);
    expect(system).not.toContain("[БЛОК ФИЛОСОФИИ");
    expect(system).toContain("1. Пиши на языке: uz.");
    expect(system).toContain("пиши строго на языке: uz (ru = русский");
    expect(system + user).not.toMatch(/\{\{\w+\}\}/);
    expect(user).toContain(JSON.stringify(profile, null, 2));
  });

  it("системная часть не зависит от профиля (её можно кэшировать)", () => {
    expect(buildTeaserPrompt({ a: 1 }, "ru").system).toBe(buildTeaserPrompt({ b: 2 }, "ru").system);
    expect(buildTeaserPrompt({ a: 1 }, "ru").system).not.toBe(buildTeaserPrompt({ a: 1 }, "uz").system);
  });

  it("неизвестный плейсхолдер — ошибка, а не тихий пропуск", () => {
    expect(() => fillTemplate("{{x}}", {})).toThrow();
  });
});
