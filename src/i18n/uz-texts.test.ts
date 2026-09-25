import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectUzTexts, mergeFixes, parseCsv, toCsv, UZ_TEXTS_FILE } from "./uz-texts";

const file = path.resolve(import.meta.dirname, "../..", UZ_TEXTS_FILE);

// `npm run uz:export` запускает этот файл с UPDATE_UZ_TEXTS=1: таблица пересоздаётся,
// уже внесённые исправления сохраняются.
if (process.env.UPDATE_UZ_TEXTS === "1") {
  const previous = existsSync(file) ? parseCsv(readFileSync(file, "utf8")) : [];
  writeFileSync(file, toCsv(mergeFixes(collectUzTexts(), previous)));
}

describe("таблица узбекских текстов docs/uz-texts.csv", () => {
  it("совпадает с текстами в коде (иначе: npm run uz:export)", () => {
    const current = collectUzTexts().map(({ key, ru, uz }) => ({ key, ru, uz }));
    const saved = parseCsv(readFileSync(file, "utf8")).map(({ key, ru, uz }) => ({ key, ru, uz }));
    expect(saved).toEqual(current);
  });

  it("ключи уникальны, узбекский текст есть в каждой строке", () => {
    const rows = collectUzTexts();
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    for (const r of rows) expect(r.uz.trim(), r.key).not.toBe("");
  });

  it("CSV читается обратно: кавычки, переносы строк, разделитель «;» от Excel", () => {
    const rows = [
      { key: "a", ru: 'Текст с "кавычками", запятой', uz: "Matn\nikki qator", fix: "" },
      { key: "b", ru: "x;y", uz: "oʻ gʻ", fix: "Tuzatish" },
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    const excel = "ключ;русский;узбекский;исправление\r\na;Да;Ha;Ha, albatta\r\n";
    expect(parseCsv(excel)).toEqual([{ key: "a", ru: "Да", uz: "Ha", fix: "Ha, albatta" }]);
  });

  it("при пересоздании сохраняет исправления владельца", () => {
    const merged = mergeFixes(
      [
        { key: "a", ru: "", uz: "yangi", fix: "" },
        { key: "b", ru: "", uz: "b", fix: "" },
      ],
      [{ key: "a", ru: "", uz: "eski", fix: "tuzatilgan" }],
    );
    expect(merged.map((r) => r.fix)).toEqual(["tuzatilgan", ""]);
  });
});
