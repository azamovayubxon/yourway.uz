// Выгрузка всех узбекских текстов сайта в таблицу docs/uz-texts.csv для вычитки носителем (этап 4б,
// колонка «где на сайте» — этап 10Д, чтобы вычитывающему не искать текст по ключу).
// Колонки: ключ, где на сайте, русский, узбекский, исправление. Владелец заполняет «исправление»
// в Numbers/Excel и возвращает файл — инструкция в docs/uz-texts-instrukciya.md.
//
// Пересоздать таблицу после правки текстов: `npm run uz:export`. Уже внесённые исправления
// при этом сохраняются (по ключу). Тест uz-texts.test.ts следит, чтобы таблица не отставала от кода.

import surveyRaw from "../../data/tests/context_survey.json";
import { MOCK_REPORTS } from "@/lib/ai/mock-reports";
import { MOCK_TEASERS } from "@/lib/ai/mock-teasers";
import { TESTS } from "@/lib/assessment/tests";
import { normalizeUzFields } from "@/lib/assessment/uzbek-text";
import { ru } from "./dictionaries/ru";
import { uz } from "./dictionaries/uz";

export const UZ_TEXTS_FILE = "docs/uz-texts.csv";
export const CSV_HEADER = ["ключ", "где на сайте", "русский", "узбекский", "исправление"] as const;

export interface UzTextRow {
  key: string;
  where: string;
  ru: string;
  uz: string;
  fix: string;
}

// «Где на сайте» — по первому сегменту ключа (для ui.* — по второму, разделы словаря совпадают
// со страницами сайта, см. src/i18n/dictionaries/ru.ts). Нужен только человеку, который вычитывает
// таблицу — на работу сайта не влияет.
const UI_SECTION_LOCATION: Record<string, string> = {
  meta: "Заголовок вкладки браузера (на всех страницах)",
  common: "Общие элементы интерфейса (шапка, кнопки, переключатель языка)",
  footer: "Подвал сайта (низ каждой страницы)",
  landing: "Главная страница (/)",
  start: "Экран-развилка (/start)",
  test: "Прохождение тестов (/test) — интерфейс вокруг вопросов",
  survey: "Контекстный опрос (/survey) — интерфейс вокруг вопросов",
  teaser: "Страница бесплатного тизера (/teaser)",
  checkout: "Страница оплаты (/checkout)",
  testPay: "Тестовая оплата (/checkout/test)",
  report: "Страница полного отчёта (/report)",
  devProfile: "Служебная страница /dev/profile (вне боевого сайта)",
  devAiLog: "Служебная страница /dev/ai-log (вне боевого сайта)",
  devAiFail: "Служебная страница /dev/ai-fail (вне боевого сайта)",
  auth: "Формы аккаунта: вход, регистрация, восстановление, выход",
  notFound: "Страница «не найдено» (404)",
};

const UI_PAGE_LOCATION: Record<string, string> = {
  howItWorks: "Статическая страница «Как это работает» (/how-it-works)",
  pricing: "Статическая страница «Цены» (/pricing)",
  faq: "Статическая страница FAQ (/faq)",
  offer: "Статическая страница «Публичная оферта» (/offer)",
  privacy: "Статическая страница «Политика конфиденциальности» (/privacy)",
  refund: "Статическая страница «Условия возврата» (/refund)",
};

function whereOnSite(key: string): string {
  const parts = key.split(".");
  if (parts[0] === "ui") {
    if (parts[1] === "pages" && parts[2]) return UI_PAGE_LOCATION[parts[2]] ?? `Статическая страница (${parts[2]})`;
    return UI_SECTION_LOCATION[parts[1] ?? ""] ?? `Интерфейс сайта (${parts[1] ?? "?"})`;
  }
  if (parts[0] === "mock" && parts[1] === "teaser") return "Тестовый режим ИИ — образец тизера (Приложение Б §9)";
  if (parts[0] === "mock" && parts[1] === "report") return "Тестовый режим ИИ — образец полного отчёта";
  if (parts[0] === "survey") return "Контекстный опрос (/survey) — текст вопросов из data/tests/context_survey.json";
  if (parts[0] === "test") return "Вопросы тестов (/test) — из data/tests/*.json";
  return "—";
}

// Все строки объекта вместе с путём: { a: { b: ["x"] } } → { "a.b.0": "x" }.
function flatten(value: unknown, path = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof value === "string") out[path] = value;
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key, out);
  }
  return out;
}

function pairRows(prefix: string, ruValue: unknown, uzValue: unknown): Omit<UzTextRow, "where">[] {
  const ruFlat = flatten(ruValue);
  const uzFlat = flatten(uzValue);
  // Пустые строки (например, пустое «adjustment» в образце отчёта) вычитывать нечего — пропускаем.
  return Object.keys(uzFlat)
    .filter((key) => uzFlat[key].trim() !== "")
    .map((key) => ({ key: `${prefix}.${key}`, ru: ruFlat[key] ?? "", uz: uzFlat[key], fix: "" }));
}

interface RawSurvey {
  sections: {
    id: string;
    title_ru: string;
    title_uz: string;
    questions: {
      id: string;
      text_ru: string;
      text_uz: string;
      options?: { value: string; label_ru: string; label_uz: string }[];
    }[];
  }[];
}

function surveyRows(): Omit<UzTextRow, "where">[] {
  const survey = normalizeUzFields(surveyRaw) as unknown as RawSurvey;
  const rows: Omit<UzTextRow, "where">[] = [];
  for (const section of survey.sections) {
    rows.push({ key: `survey.${section.id}.title`, ru: section.title_ru, uz: section.title_uz, fix: "" });
    for (const q of section.questions) {
      rows.push({ key: `survey.${q.id}.text`, ru: q.text_ru, uz: q.text_uz, fix: "" });
      for (const o of q.options ?? []) {
        rows.push({ key: `survey.${q.id}.option.${o.value}`, ru: o.label_ru, uz: o.label_uz, fix: "" });
      }
    }
  }
  return rows;
}

function testRows(): Omit<UzTextRow, "where">[] {
  return TESTS.flatMap((test) => [
    ...test.scaleLabels.map((s) => ({ key: `test.${test.id}.answer.${s.value}`, ru: s.label.ru, uz: s.label.uz, fix: "" })),
    ...test.questions.map((q) => ({ key: `test.${test.id}.q${q.id}`, ru: q.text.ru, uz: q.text.uz, fix: "" })),
  ]);
}

// Порядок: интерфейс → заготовки тизера и полного отчёта (тестовый режим) → опрос → вопросы тестов.
export function collectUzTexts(): UzTextRow[] {
  const rows = [
    ...pairRows("ui", ru, uz),
    ...pairRows("mock.teaser", MOCK_TEASERS.ru, MOCK_TEASERS.uz),
    ...pairRows("mock.report", MOCK_REPORTS.ru, MOCK_REPORTS.uz),
    ...surveyRows(),
    ...testRows(),
  ];
  return rows.map((r) => ({ ...r, where: whereOnSite(r.key) }));
}

function csvCell(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// CSV для Numbers и Excel: UTF-8 с BOM (иначе Excel портит узбекские буквы), разделитель — запятая.
export function toCsv(rows: UzTextRow[]): string {
  const lines = [CSV_HEADER as readonly string[], ...rows.map((r) => [r.key, r.where, r.ru, r.uz, r.fix])];
  return "﻿" + lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Читает таблицу, в том числе сохранённую Excel с разделителем «;» (русская версия Excel так делает).
export function parseCsv(text: string): UzTextRow[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    records.push(row);
  }
  return records
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map(([key = "", whereText = "", ruText = "", uzText = "", fix = ""]) => ({
      key,
      where: whereText,
      ru: ruText,
      uz: uzText,
      fix,
    }));
}

// Новая таблица из текущих текстов с сохранением уже внесённых исправлений (по ключу).
export function mergeFixes(rows: UzTextRow[], previous: UzTextRow[]): UzTextRow[] {
  const fixes = new Map(previous.filter((r) => r.fix.trim()).map((r) => [r.key, r.fix]));
  return rows.map((r) => ({ ...r, fix: fixes.get(r.key) ?? "" }));
}
