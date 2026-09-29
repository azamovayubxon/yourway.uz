import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OG_FONT_FILES } from "./fonts";

// Шрифты картинок «Поделиться» (Satori) должны сами рисовать узбекские oʻ gʻ (U+02BB), ʼ (U+02BC)
// и кириллицу — иначе на картинке вместо буквы будет пусто или «квадрат». Читаем таблицу cmap
// (формат 4 — все символы BMP) прямо из файла, без сторонних библиотек.

function codepoints(file: string): (cp: number) => boolean {
  const buf = readFileSync(path.join(process.cwd(), file));
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("latin1", rec, rec + 4) === "cmap") cmap = buf.readUInt32BE(rec + 8);
  }
  if (cmap < 0) throw new Error(`${file}: нет таблицы cmap`);
  const subtables = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const offset = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (buf.readUInt16BE(offset) !== 4) continue;
    const segX2 = buf.readUInt16BE(offset + 6);
    const ends = offset + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const rangeOffsets = deltas + segX2;
    return (cp) => {
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        if (cp > end) continue;
        const start = buf.readUInt16BE(starts + s * 2);
        if (cp < start) return false;
        const ro = buf.readUInt16BE(rangeOffsets + s * 2);
        if (ro === 0) return ((cp + buf.readInt16BE(deltas + s * 2)) & 0xffff) !== 0;
        const glyph = buf.readUInt16BE(rangeOffsets + s * 2 + ro + (cp - start) * 2);
        return glyph !== 0;
      }
      return false;
    };
  }
  throw new Error(`${file}: нет подтаблицы cmap формата 4`);
}

describe.each(Object.entries(OG_FONT_FILES))("шрифт картинок %s", (_, file) => {
  const has = codepoints(file);
  it("узбекские ʻ (U+02BB) и ʼ (U+02BC)", () => {
    expect(has(0x2bb)).toBe(true);
    expect(has(0x2bc)).toBe(true);
  });
  it("латиница, кириллица, кавычки и тире", () => {
    for (const ch of "AZaz ЖЯжяЁё«»—–") expect(has(ch.codePointAt(0)!), ch).toBe(true);
  });
  it("без случайного «да» на всё подряд", () => {
    expect(has(0x4e00)).toBe(false); // китайский иероглиф
  });
});
