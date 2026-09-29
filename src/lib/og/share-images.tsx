import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OG_FONT_FILES } from "./fonts";

// Картинки «Поделиться» (этап 2б), рисуются на сервере через next/og (Satori + Resvg):
//  • shareOgImage — превью ссылки /t/[code] для Telegram и других мессенджеров, 1200×630;
//  • typeCardImage — «Сохранить картинку»: вертикальная 1080×1350 для сторис, только карточка
//    типа (как на странице результата) и логотип.
// На обеих — ТОЛЬКО название типа и три сильные стороны (решение владельца).
//
// Шрифты: Commissioner 800 (заголовки) и Onest 400/700 (текст) — статичные TTF из Google Fonts,
// лежат в src/lib/og/fonts (Satori не читает woff2 и переменные шрифты, поэтому не те файлы,
// что next/font раздаёт сайту). В них есть узбекские ʻ (U+02BB), ʼ (U+02BC) и кириллица —
// это проверяет src/lib/og/fonts.test.ts. Файлы включены в сборку через outputFileTracingIncludes.


type FontOptions = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"];

let fontsPromise: Promise<FontOptions> | null = null;
function loadFonts(): Promise<FontOptions> {
  fontsPromise ??= Promise.all(
    Object.values(OG_FONT_FILES).map((file) => readFile(path.join(process.cwd(), file))),
  ).then(([display, regular, bold]) => [
    { name: "Commissioner", data: display, weight: 800, style: "normal" },
    { name: "Onest", data: regular, weight: 400, style: "normal" },
    { name: "Onest", data: bold, weight: 700, style: "normal" },
  ]);
  return fontsPromise;
}

// Цвета — те же токены, что в globals.css (Satori не читает CSS-переменные сайта).
const C = {
  bg: "#FBF7F0",
  sand: "#F3E7D3",
  line: "#EAE2D4",
  ink: "#1D1B16",
  muted: "#5E5A52",
  faint: "#8A8478",
  brand: "#C2410C",
  brandDark: "#9A3412",
  teal: "#0F766E",
  tealDark: "#0B5C56",
  onTealMuted: "#E6F7F4",
  sun: "#F5B83D",
};

export interface ShareImageData {
  locale: Locale;
  typeLabel: string;
  strengths: string[];
}

// Очень длинные строки на картинке обрезаются многоточием (на странице они показываются целиком).
function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// Кегль названия типа: самое длинное слово должно поместиться в строку (как titleFontSize на сайте).
function titleSize(label: string, width: number, max: number): number {
  const longest = Math.max(4, ...label.split(/[\s-]+/).map((w) => w.length));
  const byWord = width / (longest * 0.62);
  const byLength = label.length > 28 ? max * 0.72 : max;
  return Math.floor(Math.min(max, byWord, byLength));
}

function Rose({ size, variant = "light" }: { size: number; variant?: "light" | "dark" }) {
  const c =
    variant === "light"
      ? { n1: "#9A3412", n2: "#C2410C", a: "#5E5A52", b: "#1D1B16" }
      : { n1: "#C2410C", n2: "#F0673A", a: "#FBF7F0", b: "#BDB5A6" };
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M60 7 L48 48 L60 60Z" fill={c.n1} />
      <path d="M60 7 L72 48 L60 60Z" fill={c.n2} />
      <path d="M96 60 L72 48 L60 60Z" fill={c.a} />
      <path d="M96 60 L72 72 L60 60Z" fill={c.b} />
      <path d="M60 96 L72 72 L60 60Z" fill={c.b} />
      <path d="M60 96 L48 72 L60 60Z" fill={c.a} />
      <path d="M24 60 L48 72 L60 60Z" fill={c.b} />
      <path d="M24 60 L48 48 L60 60Z" fill={c.a} />
    </svg>
  );
}

// Иллюстрация карточки (как TypeIllustration на сайте): компас в кремовом круге, пунктирное
// кольцо, «солнце», крестики и тропинка на тёмно-бирюзовом поле.
function Illustration({ width, height, decor = true }: { width: number; height: number; decor?: boolean }) {
  const k = height / 150;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <div style={{ display: "flex", width, height, borderRadius: 30 * k, background: C.tealDark, position: "relative" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {decor && <circle cx={width - 50 * k} cy={36 * k} r={17 * k} fill={C.sun} />}
        {decor && (
          <path
            d={`M${44 * k} ${34 * k} l${10 * k} ${10 * k} M${54 * k} ${34 * k} l${-10 * k} ${10 * k} M${width - 68 * k} ${104 * k} l${10 * k} ${10 * k} M${width - 58 * k} ${104 * k} l${-10 * k} ${10 * k}`}
            stroke={C.sun}
            strokeWidth={3 * k}
            strokeLinecap="round"
          />
        )}
        {decor && (
          <path
            d={`M${34 * k} ${118 * k} C ${62 * k} ${96 * k}, ${84 * k} ${124 * k}, ${112 * k} ${106 * k}`}
            fill="none"
            stroke={C.sun}
            strokeWidth={3 * k}
            strokeLinecap="round"
            strokeDasharray={`0.1 ${8 * k}`}
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={56 * k}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={2.6 * k}
          strokeLinecap="round"
          strokeDasharray={`0.1 ${8.4 * k}`}
        />
        <circle cx={cx} cy={cy} r={36 * k} fill={C.bg} />
      </svg>
      <div style={{ display: "flex", position: "absolute", left: cx - 28 * k, top: cy - 28 * k }}>
        <Rose size={56 * k} />
      </div>
    </div>
  );
}

function Wordmark({ size, light = false }: { size: number; light?: boolean }) {
  return (
    <div style={{ display: "flex", fontFamily: "Commissioner", fontWeight: 800, fontSize: size, letterSpacing: -0.5 }}>
      <span style={{ color: light ? "#FFFFFF" : C.ink }}>your</span>
      <span style={{ color: light ? C.sun : C.brand }}>way</span>
      <span style={{ color: light ? "#FFFFFF" : C.faint }}>.uz</span>
    </div>
  );
}

// ─── Превью ссылки для Telegram, 1200×630 ────────────────────────────────────────────────────────
export const OG_SIZE = { width: 1200, height: 630 };

export async function shareOgImage(data: ShareImageData): Promise<ImageResponse> {
  const t = getDictionary(data.locale).sharePage;
  const strengths = data.strengths.map((s) => clip(s, 42));
  const size = titleSize(data.typeLabel, 600, 92);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: C.bg,
          position: "relative",
          fontFamily: "Onest",
          color: C.ink,
        }}
      >
        <div
          style={{ display: "flex", position: "absolute", right: -140, top: -170, width: 440, height: 440, borderRadius: 220, background: C.sand }}
        />
        {/* Повёрнутая бирюзовая карточка. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: 70,
            top: 72,
            width: 360,
            height: 486,
            borderRadius: 40,
            background: C.teal,
            padding: 32,
            transform: "rotate(-4deg)",
            boxShadow: "0 30px 60px rgba(15,118,110,0.22)",
          }}
        >
          <div style={{ display: "flex", color: C.onTealMuted, fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
            {t.label.toLocaleUpperCase(data.locale)}
          </div>
          <div style={{ display: "flex", marginTop: 20 }}>
            <Illustration width={296} height={340} decor={false} />
          </div>
          <div style={{ display: "flex", marginTop: 22 }}>
            <Wordmark size={30} light />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "absolute",
            left: 500,
            top: 0,
            width: 640,
            height: 630,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: C.muted }}>{t.ogLabel}</div>
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontFamily: "Commissioner",
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.04,
              letterSpacing: -1,
              color: C.ink,
            }}
          >
            {clip(data.typeLabel, 60)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 30, gap: 12 }}>
            {strengths.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  padding: "12px 22px",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  border: `2px solid ${C.line}`,
                  fontSize: 24,
                  fontWeight: 700,
                  color: C.ink,
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 48, gap: 18 }}>
            <Rose size={52} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Wordmark size={36} />
              <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 2 }}>{t.ctaTitle}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}

// ─── «Сохранить картинку»: вертикальная 1080×1350 для сторис ────────────────────────────────────
export const STORY_SIZE = { width: 1080, height: 1350 };

export async function typeCardImage(data: ShareImageData, headers: Record<string, string>): Promise<ImageResponse> {
  const dict = getDictionary(data.locale);
  const strengths = data.strengths.map((s) => clip(s, 60));
  const size = titleSize(data.typeLabel, 760, 116);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: C.bg,
          fontFamily: "Onest",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 880,
            borderRadius: 72,
            background: C.teal,
            padding: 56,
            color: "#FFFFFF",
            boxShadow: "0 40px 80px rgba(15,118,110,0.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: C.onTealMuted,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            <span>{dict.teaser.yourType.toLocaleUpperCase(data.locale)}</span>
            <span>YOURWAY.UZ</span>
          </div>
          <div style={{ display: "flex", marginTop: 32 }}>
            <Illustration width={768} height={360} />
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 44,
              fontFamily: "Commissioner",
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.04,
              letterSpacing: -1.5,
            }}
          >
            {clip(data.typeLabel, 60)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 36, gap: 16 }}>
            {strengths.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  padding: "14px 28px",
                  borderRadius: 999,
                  background: C.tealDark,
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 64, gap: 18 }}>
          <Rose size={64} />
          <Wordmark size={52} />
        </div>
      </div>
    ),
    { ...STORY_SIZE, fonts: await loadFonts(), headers },
  );
}
