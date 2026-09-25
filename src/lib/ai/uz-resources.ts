// Узбекские материалы для промпта (этап 4б): глоссарий и эталонные тексты.
// Владелец правит их в обычных файлах документации, а программа читает при работе сервера:
//   docs/uz-glossary.md         — названия типов, шкал, ценностей + стоп-слова и запрещённые конструкции;
//   docs/uz-teaser-examples.md  — эталонные тексты носителя (образец стиля).
// Файлы включены в сборку через outputFileTracingIncludes в next.config.ts, поэтому работают
// и на Vercel, и на обычном сервере с `next start`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeUzApostrophes } from "@/lib/assessment/uzbek-text";
import type { UzRules } from "./uz-style";

export const UZ_GLOSSARY_FILE = "docs/uz-glossary.md";
export const UZ_EXAMPLES_FILE = "docs/uz-teaser-examples.md";

export const GLOSSARY_TABLES = [
  "riasec",
  "big_five",
  "levels",
  "sixteen_types",
  "values",
  "learning_styles",
  "terms",
] as const;
export type GlossaryTable = (typeof GLOSSARY_TABLES)[number];

export interface GlossaryRow {
  code: string;
  ru: string;
  uz: string;
  note: string;
}

export interface UzGlossary extends UzRules {
  tables: Record<GlossaryTable, GlossaryRow[]>;
}

// Любые апострофы (‘ ’ ` ') → oʻ gʻ и ʼ, как в остальных узбекских текстах (решение (Б)).
export function normalizeUz(text: string): string {
  return normalizeUzApostrophes(text.replace(/[‘’`]/g, "'"));
}

// Делит markdown на разделы по меткам `<!-- section: name -->`.
function sections(markdown: string): Map<string, string> {
  const result = new Map<string, string>();
  const parts = markdown.split(/<!--\s*section:\s*([\w-]+)\s*-->/);
  for (let i = 1; i < parts.length; i += 2) {
    // Раздел заканчивается на следующем заголовке.
    result.set(parts[i], parts[i + 1].split(/\n#{1,6} /)[0]);
  }
  return result;
}

function tableRows(body: string): GlossaryRow[] {
  const rows: GlossaryRow[] = [];
  for (const line of body.split("\n")) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const code = cells[0]?.match(/^`([^`]+)`$/)?.[1];
    if (!code) continue; // заголовок таблицы, разделитель или пустая строка
    rows.push({ code, ru: cells[1] ?? "", uz: normalizeUz(cells[2] ?? ""), note: normalizeUz(cells[3] ?? "") });
  }
  return rows;
}

function listItems(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1])
    .filter((item): item is string => Boolean(item))
    .map(normalizeUz);
}

export function parseUzGlossary(markdown: string): UzGlossary {
  const found = sections(markdown);
  const tables = {} as Record<GlossaryTable, GlossaryRow[]>;
  for (const name of GLOSSARY_TABLES) {
    const body = found.get(name);
    if (body === undefined) throw new Error(`В ${UZ_GLOSSARY_FILE} нет раздела <!-- section: ${name} -->`);
    tables[name] = tableRows(body).filter((row) => row.uz);
  }
  return {
    tables,
    stopWords: listItems(found.get("stop_words") ?? ""),
    forbiddenPhrases: listItems(found.get("forbidden_phrases") ?? ""),
  };
}

// Эталоны: текст под каждым заголовком «## Namuna …» до следующего заголовка второго уровня.
// Первая строка-пометка «Автор: …» — для владельца, в промпт не идёт.
export function parseUzExamples(markdown: string): string[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .filter((part) => /^Namuna\b/i.test(part))
    .map((part) =>
      part
        .split("\n")
        .slice(1)
        .filter((line) => !/^Автор:/.test(line.trim()))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .map(normalizeUz);
}

function readDoc(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

// Файлы читаются один раз за время работы сервера. В режиме разработки (npm run dev) — при каждом
// обращении, чтобы правки владельца были видны без перезапуска.
const cache = new Map<string, unknown>();
function cached<T>(key: string, load: () => T): T {
  if (process.env.NODE_ENV === "development") return load();
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as T;
}

export function getUzGlossary(): UzGlossary {
  return cached("glossary", () => parseUzGlossary(readDoc(UZ_GLOSSARY_FILE)));
}

export function getUzExamples(): string[] {
  return cached("examples", () => parseUzExamples(readDoc(UZ_EXAMPLES_FILE)));
}

// Узбекское название 16-типа из глоссария (или undefined, если в глоссарии его нет).
export function uzSixteenTypeName(code: string): string | undefined {
  return getUzGlossary().tables.sixteen_types.find((row) => row.code === code)?.uz;
}

const TABLE_TITLES: Record<GlossaryTable, string> = {
  riasec: "RIASEC qiziqish turlari (riasec.code harflari)",
  big_five: "Shaxsiyat shkalalari (big_five)",
  levels: "Ball darajalari",
  sixteen_types: "16 shaxsiyat tipi (sixteen_type.code)",
  values: "Qadriyatlar (values_ranked)",
  learning_styles: "Oʻrganish uslublari (learning_style)",
  terms: "Boshqa tushunchalar",
};

// Глоссарий в виде текста для промпта: «- код — узбекское название (пояснение)».
export function formatGlossaryForPrompt(glossary: UzGlossary): string {
  return GLOSSARY_TABLES.map((name) => {
    const lines = glossary.tables[name].map(
      (row) => `- ${row.code} — ${row.uz}${row.note ? ` (${row.note})` : ""}`,
    );
    return `${TABLE_TITLES[name]}:\n${lines.join("\n")}`;
  }).join("\n\n");
}

export function formatExamplesForPrompt(examples: string[]): string {
  return examples.map((text, i) => `--- ${i + 1}-namuna ---\n${text}`).join("\n\n");
}
