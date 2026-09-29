import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { MOCK_REPORTS } from "@/lib/ai/mock-reports";
import { mergeReportParts, type ReportContent } from "@/lib/ai/report-schema";
import { fmt } from "@/i18n/format";
import type { ReportFirstScreen } from "@/lib/report/present";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";
import { registerPdfFonts } from "./fonts";
import { ReportDocument, type ReportPdfProps } from "./ReportDocument";

// render.tsx импортирует "server-only" (страж от случайного импорта в клиентском коде) — vitest
// не эмулирует границу сервер/клиент Next.js, поэтому здесь та же логика без обёртки render.tsx.
async function renderReportPdf(props: ReportPdfProps): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<ReportDocument {...props} />);
}

// ⚠️ styles.page в ReportDocument.tsx намеренно без lineHeight — с ним react-pdf 4.9 молча
// перестаёт печатать динамический текст (номер страницы) в колонтитуле. Если это изменится,
// проверить получившийся PDF глазами (номера страниц вверху).
// Соответствует buildFirstScreen (src/lib/report/present.ts, покрыта тестами там); здесь — просто
// готовый проп, чтобы не тянуть в этот файл "server-only" через @/lib/payments.
const summaryFor = (content: ReportContent): ReportFirstScreen => ({
  takeaway: content.takeaway ?? content.portrait.summary,
  direction: content.goal.statement,
  firstStep: content.act_now[0] ?? "",
  constraints: (content.main_path.limitations ?? []).join(" · "),
});

function mockContent(locale: "ru" | "uz", path: "stated" | "constructed"): ReportContent {
  const mock = MOCK_REPORTS[locale];
  return mergeReportParts({
    portrait_goal: { portrait: mock.portrait, goal: mock.goal[path], reality_check: mock.reality_check[path] },
    main_path: mock.main_path,
    finish: mock.finish,
  });
}

// ── Разбор готового PDF ──
// react-pdf встраивает только использованные знаки шрифта (подмножество) и для каждого шрифта
// пишет таблицу ToUnicode: какие символы текста он рисует. Если знака нет ни в одном шрифте,
// react-pdf молча выкидывает его из текста — тогда его нет и в ToUnicode. Поэтому проверяем по
// самому PDF: какой шрифт встроен и какие символы он действительно нарисовал.

interface PdfInfo {
  fonts: Map<string, Set<number>>; // имя шрифта (без префикса подмножества) → символы
  pages: number;
}

function readPdf(pdf: Buffer): PdfInfo {
  const raw = pdf.toString("latin1");
  const objects = new Map<string, string>();
  for (const m of raw.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(m[1]!, m[2]!);

  const streamOf = (body: string): string => {
    const start = body.indexOf("stream");
    const end = body.lastIndexOf("endstream");
    if (start < 0 || end < 0) return "";
    let from = start + "stream".length;
    if (body[from] === "\r") from++;
    if (body[from] === "\n") from++;
    const bytes = Buffer.from(body.slice(from, end), "latin1");
    return /\/FlateDecode/.test(body.slice(0, start)) ? inflateSync(bytes).toString("latin1") : bytes.toString("latin1");
  };
  const utf16 = (hex: string): number[] => {
    const units: number[] = [];
    for (let i = 0; i + 4 <= hex.length; i += 4) units.push(parseInt(hex.slice(i, i + 4), 16));
    return [...String.fromCharCode(...units)].map((c) => c.codePointAt(0)!);
  };
  const cmapChars = (cmap: string): Set<number> => {
    const chars = new Set<number>();
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const line of block[1]!.split("\n")) {
        const arr = line.match(/\[(.*)\]/);
        if (arr) for (const h of arr[1]!.matchAll(/<([0-9a-fA-F]+)>/g)) utf16(h[1]!).forEach((c) => chars.add(c));
        else {
          const parts = [...line.matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]!);
          if (parts.length === 3) {
            const [lo, hi, dst] = parts.map((p) => parseInt(p, 16)) as [number, number, number];
            for (let i = 0; i <= hi - lo; i++) chars.add(dst + i);
          }
        }
      }
    }
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const line of block[1]!.split("\n")) {
        const parts = [...line.matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]!);
        if (parts.length === 2) utf16(parts[1]!).forEach((c) => chars.add(c));
      }
    }
    return chars;
  };

  const fonts = new Map<string, Set<number>>();
  let pages = 0;
  for (const body of objects.values()) {
    if (/\/Type\s*\/Page\b/.test(body)) pages++;
    const base = body.match(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([^\s/<>\]]+)/);
    const toUnicode = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!base || !toUnicode || !/\/Type\s*\/Font/.test(body)) continue;
    const chars = cmapChars(streamOf(objects.get(toUnicode[1]!) ?? ""));
    const name = base[1]!;
    fonts.set(name, new Set([...(fonts.get(name) ?? []), ...chars]));
  }
  return { fonts, pages };
}

// Все строки отчёта от ИИ — ровно то, что должно оказаться в PDF. Кроме служебных кодов
// (тип маршрута, вердикт, сложность, источник цели): вместо них печатаются подписи из словаря.
const CODE_FIELDS = new Set(["type", "verdict", "effort_level", "source"]);
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => (CODE_FIELDS.has(k) ? [] : strings(v)));
  return [];
}

const CASES = [
  { locale: "ru" as const, t: ru, path: "stated" as const, sixteen: "INTP · Логик", type: "Исследователь-Творец" },
  { locale: "uz" as const, t: uz, path: "constructed" as const, sixteen: "INTP · Mantiqchi", type: "Izlanuvchan ijodkor" },
];

describe.each(CASES)("PDF отчёта [$locale]", ({ locale, t, path, sixteen, type }) => {
  const content = mockContent(locale, path);
  const pdfPromise = renderReportPdf({
    content,
    t: t.report,
    levelName: t.checkout.levels.navigator.name,
    sixteenType: sixteen,
    learningStyles: [t.report.learningStyles.practice],
    date: "25.09.2026",
    typeLabel: type,
    mockNote: locale === "ru" ? `${ru.teaser.mockBadge}. ${ru.teaser.mockNote}` : null,
    languageNote: fmt(t.report.languageNote, { lang: t.report.languageNames[locale] }),
    languageShort: fmt(t.report.languageShort, { lang: t.report.languageNames[locale] }),
    summary: summaryFor(content),
  });

  it("собирается: обложка и внутренние страницы", async () => {
    const pdf = await pdfPromise;
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(readPdf(pdf).pages).toBeGreaterThanOrEqual(3);
  });

  it("заголовки — Commissioner ExtraBold, текст — Onest; запасной Noto Sans не понадобился", async () => {
    const names = [...readPdf(await pdfPromise).fonts.keys()];
    expect(names.some((n) => /^Commissioner.*ExtraBold/i.test(n)), names.join(", ")).toBe(true);
    expect(names.some((n) => /^Onest.*Regular/i.test(n)), names.join(", ")).toBe(true);
    expect(names.some((n) => /^Onest.*Bold/i.test(n)), names.join(", ")).toBe(true);
    expect(names.filter((n) => /Noto/i.test(n)), "какой-то знак не нашёлся в Onest/Commissioner").toEqual([]);
  });

  it("ни один знак текста отчёта не пропал (react-pdf молча выкидывает отсутствующие)", async () => {
    const { fonts } = readPdf(await pdfPromise);
    const drawn = new Set([...fonts.values()].flatMap((s) => [...s]));
    const missing = new Set<string>();
    for (const s of strings(content)) for (const ch of s) if (!/\s/.test(ch) && !drawn.has(ch.codePointAt(0)!)) missing.add(ch);
    expect([...missing]).toEqual([]);
  });

  if (locale === "uz") {
    it("узбекские ʻ (U+02BB) и ʼ (U+02BC) нарисованы шрифтами Onest и Commissioner", async () => {
      const { fonts } = readPdf(await pdfPromise);
      const onest = [...fonts].filter(([n]) => /^Onest/i.test(n)).flatMap(([, s]) => [...s]);
      const commissioner = [...fonts].filter(([n]) => /^Commissioner/i.test(n)).flatMap(([, s]) => [...s]);
      expect(onest).toContain(0x2bb);
      expect(onest).toContain(0x2bc);
      expect(commissioner).toContain(0x2bb); // «Natijalaringiz nimani koʻrsatadi?», «Toʻliq hisobot»
    });
  } else {
    it("кириллица нарисована шрифтами Onest и Commissioner", async () => {
      const { fonts } = readPdf(await pdfPromise);
      const onest = new Set([...fonts].filter(([n]) => /^Onest/i.test(n)).flatMap(([, s]) => [...s]));
      const commissioner = new Set([...fonts].filter(([n]) => /^Commissioner/i.test(n)).flatMap(([, s]) => [...s]));
      for (const ch of "ПрофиьЫё") expect(onest.has(ch.codePointAt(0)!), ch).toBe(true);
      // Заголовки разделов набраны Commissioner — каждый их знак должен быть в нём.
      for (const ch of Object.values(ru.report.sections).join("").replace(/\s/g, ""))
        expect(commissioner.has(ch.codePointAt(0)!), ch).toBe(true);
    });
  }
});
