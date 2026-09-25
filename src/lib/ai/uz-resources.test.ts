import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { uz } from "@/i18n/dictionaries/uz";
import { SCALE_ORDER, SIXTEEN_TYPES, TESTS } from "@/lib/assessment/tests";
import { normalizeUzFields } from "@/lib/assessment/uzbek-text";
import surveyRaw from "../../../data/tests/context_survey.json";
import { MOCK_TEASERS } from "./mock-teasers";
import { validateTeaser } from "./teaser-schema";
import { getUzExamples, getUzGlossary, parseUzExamples, parseUzGlossary } from "./uz-resources";
import { findUzIssues } from "./uz-style";

const glossary = getUzGlossary();
const codes = (table: keyof typeof glossary.tables) => glossary.tables[table].map((r) => r.code).sort();

describe("узбекский глоссарий (docs/uz-glossary.md)", () => {
  it("содержит все коды тестов и 16 типов", () => {
    expect(codes("riasec")).toEqual([...SCALE_ORDER.riasec].sort());
    expect(codes("values")).toEqual([...SCALE_ORDER.values].sort());
    expect(codes("learning_styles")).toEqual([...SCALE_ORDER.perception].sort());
    expect(codes("big_five")).toEqual(
      ["agreeableness", "conscientiousness", "extraversion", "neuroticism", "openness"].sort(),
    );
    expect(codes("sixteen_types")).toEqual(Object.keys(SIXTEEN_TYPES).sort());
    expect(codes("levels")).toEqual(["high", "low", "medium"]);
  });

  it("названия — на узбекском латиницей, апострофы приведены к oʻ gʻ ʼ", () => {
    for (const rows of Object.values(glossary.tables)) {
      for (const row of rows) {
        expect(row.uz).not.toMatch(/\p{Script=Cyrillic}/u);
        expect(row.uz).not.toMatch(/['‘’`]/);
        expect(findUzIssues(row.uz, glossary)).toEqual([]);
      }
    }
  });

  it("стоп-список и запрещённые конструкции прочитаны", () => {
    expect(glossary.stopWords).toEqual(expect.arrayContaining(["entrepreneur", "pragmatist", "commerce", "business", "startup", "venture"]));
    expect(glossary.forbiddenPhrases).toEqual(
      expect.arrayContaining(["A nuqta", "B nuqta", "halol oraliq", "reallikka tekshir"]),
    );
  });

  it("разбор таблиц: апостроф в ячейке исправляется, строки без кода пропускаются", () => {
    const md = [
      "<!-- section: riasec -->",
      "| Код | Русский | Узбекский | Пояснение |",
      "|---|---|---|---|",
      "| `R` | Реалистичный | Qo'l ustasi | tog' |",
      "",
      ...["big_five", "levels", "sixteen_types", "values", "learning_styles", "terms"].map(
        (s) => `<!-- section: ${s} -->\n`,
      ),
      "<!-- section: stop_words -->",
      "- Business",
    ].join("\n");
    const parsed = parseUzGlossary(md);
    expect(parsed.tables.riasec).toEqual([{ code: "R", ru: "Реалистичный", uz: "Qoʻl ustasi", note: "togʻ" }]);
    expect(parsed.stopWords).toEqual(["Business"]);
    expect(parsed.forbiddenPhrases).toEqual([]);
    expect(() => parseUzGlossary("")).toThrow(/section: riasec/);
  });
});

describe("эталонные тексты (docs/uz-teaser-examples.md)", () => {
  it("есть хотя бы один эталон, служебные строки в промпт не попадают", () => {
    const examples = getUzExamples();
    expect(examples.length).toBeGreaterThanOrEqual(1);
    for (const text of examples) {
      expect(text).not.toMatch(/Автор:|##/);
      expect(text).not.toMatch(/['‘’`]/);
    }
  });

  it("написаны на «siz», без английских слов и запрещённых конструкций", () => {
    for (const text of getUzExamples()) expect(findUzIssues(text, glossary)).toEqual([]);
  });

  it("берёт только разделы «## Namuna …»", () => {
    const md = "# Заголовок\nинструкция\n## Как это работает\nтекст\n## Namuna 1\nАвтор: я\n\nSiz o‘qing\n## Namuna 2\n\n";
    expect(parseUzExamples(md)).toEqual(["Siz oʻqing"]);
  });
});

describe("узбекские тексты сайта проходят ту же проверку, что и ответ ИИ", () => {
  const collect = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
    else if (value && typeof value === "object") Object.values(value).forEach((v) => collect(v, out));
    return out;
  };
  const surveyUz: string[] = [];
  const walk = (value: unknown, key = "") => {
    if (typeof value === "string") {
      if (key.endsWith("_uz")) surveyUz.push(value);
    } else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(normalizeUzFields(surveyRaw));

  it.each([
    ["словарь интерфейса uz.ts", collect(uz)],
    ["вопросы тестов", TESTS.flatMap((t) => [...t.questions.map((q) => q.text.uz), ...t.scaleLabels.map((l) => l.label.uz)])],
    ["контекстный опрос", surveyUz],
  ])("%s: нет кириллицы, «sen», английских слов и запрещённых конструкций", (_name, texts) => {
    const problems = texts.flatMap((text) => findUzIssues(text, glossary).map((i) => `${i.rule}:${i.word} ← ${text}`));
    expect(problems).toEqual([]);
  });

  it("заготовка тизера для тестового режима проходит проверку ответа ИИ", () => {
    expect(validateTeaser(MOCK_TEASERS.uz, "uz", glossary)).toMatchObject({ ok: true });
  });
});

describe("обращение на «вы» в русских текстах", () => {
  const TY = /(?<![а-яё])(ты|тебе|тебя|тобой|твой|твоя|твои|твоё|твое|твоих|твоим|твоей|твою|твоего|твоему)(?![а-яё])/i;
  const docA = readFileSync(path.resolve(import.meta.dirname, "../../../docs/prilozhenie-a-testy-i-opros.md"), "utf8");

  it("в заготовке тизера и в тексте Приложения А нет «ты»", () => {
    expect(JSON.stringify(MOCK_TEASERS.ru)).not.toMatch(TY);
    expect(docA).not.toMatch(TY);
  });
});
