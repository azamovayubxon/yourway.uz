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
  UZ_RULES_TEMPLATE,
} from "./prompts";
import { getUzExamples, getUzGlossary } from "./uz-resources";

// Промпты должны совпадать с Приложением Б дословно (CLAUDE.md §7).
const doc = readFileSync(path.resolve(import.meta.dirname, "../../../docs/prilozhenie-b-prompty.md"), "utf8");
const codeBlocks = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ""));

describe("промпты тизера (Приложение Б)", () => {
  it("перенесены из документа дословно", () => {
    expect(codeBlocks).toContain(PHILOSOPHY_BLOCK);
    expect(codeBlocks).toContain(TEASER_SYSTEM_TEMPLATE);
    expect(codeBlocks).toContain(TEASER_USER_TEMPLATE);
    expect(codeBlocks).toContain(UZ_RULES_TEMPLATE);
    expect(doc).toContain("`" + LANGUAGE_LINE + "`");
  });

  it("подставляют философию, язык и профиль; плейсхолдеров не остаётся", () => {
    const profile = { language: "uz", big_five: { openness: 88 } };
    const { system, user } = buildTeaserPrompt(profile, "uz");
    expect(system.startsWith(PHILOSOPHY_BLOCK)).toBe(true);
    expect(system).not.toContain("[БЛОК ФИЛОСОФИИ");
    expect(system).toContain("1. Пишите на языке: uz.");
    expect(system).toContain("пишите строго на языке: uz (ru = русский");
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

// Обращение на «вы» (решение в CLAUDE.md §10): в промптах нет ни одного «ты»-слова.
const TY_WORDS = /(?<![а-яё])(ты|тебе|тебя|тобой|твой|твоя|твои|твоё|твое|твоих|твоим|твоей|твою|твоего|твоему)(?![а-яё])/i;

describe("обращение на «вы» и узбекский блок", () => {
  it("в промптах нет обращения на «ты»", () => {
    for (const text of [PHILOSOPHY_BLOCK, TEASER_SYSTEM_TEMPLATE, TEASER_USER_TEMPLATE, LANGUAGE_LINE]) {
      expect(text).not.toMatch(TY_WORDS);
    }
    expect(PHILOSOPHY_BLOCK).toContain("«вы»");
    expect(PHILOSOPHY_BLOCK).toContain("«siz»");
  });

  it("узбекский блок добавляется только для uz, с глоссарием, стоп-словами и эталонами", () => {
    const ru = buildTeaserPrompt({}, "ru").system;
    const uz = buildTeaserPrompt({}, "uz").system;
    expect(ru).not.toContain("OʻZBEK TILIDA YOZISH QOIDALARI");
    expect(uz).toContain("OʻZBEK TILIDA YOZISH QOIDALARI");
    expect(uz).not.toMatch(/\{\{\w+\}\}/);
    // Глоссарий: названия из docs/uz-glossary.md.
    const glossary = getUzGlossary();
    expect(uz).toContain(`- INFP — ${glossary.tables.sixteen_types.find((r) => r.code === "INFP")!.uz}`);
    expect(uz).toContain("«entrepreneur»");
    expect(uz).toContain("«A nuqta»");
    // Эталоны: текст из docs/uz-teaser-examples.md (апострофы приведены к oʻ gʻ).
    for (const example of getUzExamples()) expect(uz).toContain(example);
    expect(uz).toContain("Sizga mos yoʻnalishlar");
  });

  it("узбекский блок можно собрать из переданных материалов (без чтения файлов)", () => {
    const glossary = { ...getUzGlossary(), stopWords: ["foo"], forbiddenPhrases: ["bar baz"] };
    const { system } = buildTeaserPrompt({}, "uz", { glossary, examples: ["Namuna matni"] });
    expect(system).toContain("«foo»");
    expect(system).toContain("«bar baz»");
    expect(system).toContain("--- 1-namuna ---\nNamuna matni");
  });
});
