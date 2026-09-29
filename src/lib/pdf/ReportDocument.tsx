// Брендированный PDF полного отчёта (этап 7; новый стиль — этап 3). Та же структура, что у
// онлайн-страницы (ReportView), но без интерактивности: все варианты маршрута раскрыты, чек-листы —
// пустыми квадратами для печати (PDF читают и печатают, в том числе показывают родителям).
// Первая страница — обложка (кремовая), дальше — белые страницы с тонкой строкой сверху
// (компас, «yourway.uz · цель», номер страницы) и дисклеймером внизу. Шрифты — Commissioner и
// Onest (src/lib/pdf/fonts.ts).

import { Circle, Document, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";
import type { ReportContent, ReportRoute } from "@/lib/ai/report-schema";
import type { ReportFirstScreen } from "@/lib/report/present";
import { splitIntoParagraphs } from "@/lib/report/paragraphs";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { PDF_BODY_FONTS, PDF_DISPLAY_FONTS, PDF_DISPLAY_WEIGHT } from "./fonts";

type ReportDict = Dictionary["report"];

export interface ReportPdfProps {
  content: ReportContent;
  t: ReportDict;
  levelName: string;
  sixteenType: string;
  learningStyles: string[];
  date: string;
  // Название типа для обложки: из тизера (как в кабинете и на странице результата), если тизер
  // есть, иначе — из портрета самого отчёта.
  typeLabel: string;
  // Первый экран (ТЗ аудита §9): собран из уже готового отчёта тем же кодом, что и на онлайн-странице
  // (buildFirstScreen, src/lib/report/present.ts) — вызывающий код передаёт готовый результат, чтобы
  // ReportDocument.tsx не тянул за собой "server-only" через @/lib/payments и оставался тестируемым.
  summary: ReportFirstScreen;
  // Плашка «тестовый режим ИИ» (мок-режим) — как на онлайн-странице.
  mockNote: string | null;
  // Явная строка «на каком языке отчёт» (аудит UX-06) — как на онлайн-странице, показывается
  // всегда: текст отчёта на report.locale, а колонтитулы и подписи — на языке интерфейса.
  languageNote: string;
  // Коротко — для обложки: «Hisobot tili: oʻzbek».
  languageShort: string;
}

// Палитра — те же токены, что на сайте (src/app/globals.css).
const C = {
  cream: "#FBF7F0",
  white: "#FFFFFF",
  ink: "#1D1B16",
  muted: "#5E5A52",
  faint: "#8A8478",
  line: "#EAE2D4",
  sand: "#F3E7D3",
  brand: "#C2410C",
  brand50: "#FBE9DF",
  brand700: "#7C2D12",
  teal: "#0F766E",
  teal50: "#D8EFEC",
  teal800: "#0B5C56",
  onTealMuted: "#E6F7F4",
  sun: "#F5B83D",
  sun50: "#FDF0D3",
  sun100: "#FBEBC4",
  sunInk: "#5E4A12",
};

const display = { fontFamily: PDF_DISPLAY_FONTS, fontWeight: PDF_DISPLAY_WEIGHT } as const;

const styles = StyleSheet.create({
  // lineHeight здесь намеренно не задаём (даже общий на всю страницу): в react-pdf 4.9 он ломает
  // текст с динамическим render (номер страницы в колонтитуле, ниже) — тот перестаёт печататься
  // без ошибки (баг библиотеки). У параграфов lineHeight задан отдельно, на самих стилях.
  cover: {
    fontFamily: PDF_BODY_FONTS,
    backgroundColor: C.cream,
    color: C.ink,
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 40,
  },
  page: {
    fontFamily: PDF_BODY_FONTS,
    backgroundColor: C.white,
    fontSize: 10.5,
    color: C.ink,
    paddingTop: 64,
    paddingBottom: 58,
    paddingHorizontal: 44,
  },

  // Обложка
  coverCircle: {
    position: "absolute",
    top: -150,
    right: -150,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: C.sun50,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoText: { ...display, fontSize: 17 },
  coverBody: { flexGrow: 1, justifyContent: "center" },
  kicker: { fontSize: 9, fontWeight: 700, color: C.teal, letterSpacing: 1.4 },
  coverTitle: { ...display, marginTop: 10, lineHeight: 1.12 },
  typeBadge: {
    marginTop: 24,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.teal,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 380,
  },
  typeBadgeLabel: { fontSize: 7.5, fontWeight: 700, color: C.onTealMuted, letterSpacing: 1 },
  typeBadgeName: { ...display, fontSize: 15, color: C.white, marginTop: 2, lineHeight: 1.2 },
  typeBadgeSub: { fontSize: 8, color: C.onTealMuted, marginTop: 2 },
  coverFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    fontSize: 8.5,
    color: C.muted,
  },
  coverMock: { fontSize: 8, color: C.sunInk, backgroundColor: C.sun100, borderRadius: 8, padding: 8, marginTop: 18, maxWidth: 380 },

  // Колонтитулы внутренних страниц (fixed — повторяются на каждой странице).
  header: {
    position: "absolute",
    top: 24,
    left: 44,
    right: 44,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerText: { fontSize: 7.5, color: C.muted, flex: 1 },
  headerPage: { fontSize: 7.5, color: C.muted, width: 30, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  footerText: { fontSize: 7, color: C.muted },

  // Разделы
  section: { marginTop: 22 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  sectionNumber: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionNumberText: { ...display, fontSize: 10, color: C.white },
  sectionTitle: { ...display, fontSize: 15, color: C.ink, flex: 1, lineHeight: 1.2 },

  body: { fontSize: 10.5, color: C.ink, lineHeight: 1.5 },
  bodyMuted: { fontSize: 9.5, color: C.muted, lineHeight: 1.5 },
  label: { fontSize: 7.5, fontWeight: 700, color: C.muted, letterSpacing: 0.8 },
  bold: { fontWeight: 700 },

  card: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, marginTop: 8 },
  softBox: { borderRadius: 12, padding: 12, marginTop: 8 },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  pill: { fontSize: 8.5, backgroundColor: C.sand, borderRadius: 9, paddingVertical: 3, paddingHorizontal: 8, color: C.ink },

  listItem: { flexDirection: "row", gap: 7, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 4.5 },
  listText: { fontSize: 10, color: C.ink, flex: 1, lineHeight: 1.45 },

  numBox: {
    width: 16,
    height: 16,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand50,
  },
  numText: { fontSize: 8.5, fontWeight: 700, color: C.brand700 },

  checkbox: { width: 11, height: 11, borderWidth: 1.3, borderColor: C.faint, borderRadius: 3, marginTop: 1.5 },
});

// Знак-компас векторно (те же контуры, что CompassRose в src/components/Logo.tsx).
// Правила знака: север (терракотовый луч) вверху, не вращать, цвета не менять.
function Compass({ size, variant = "light" }: { size: number; variant?: "light" | "dark" }) {
  const c =
    variant === "light"
      ? { n1: "#9A3412", n2: "#C2410C", a: "#5E5A52", b: "#1D1B16", ring: "#1D1B16" }
      : { n1: "#C2410C", n2: "#F0673A", a: "#FBF7F0", b: "#BDB5A6", ring: "#FBF7F0" };
  return (
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      {size >= 40 && (
        <Circle cx="60" cy="60" r="56" fill="none" stroke={c.ring} strokeWidth={3.4} strokeDasharray="0.1 8.8" strokeLinecap="round" opacity={0.5} />
      )}
      <Path d="M60 7 L48 48 L60 60Z" fill={c.n1} />
      <Path d="M60 7 L72 48 L60 60Z" fill={c.n2} />
      <Path d="M96 60 L72 48 L60 60Z" fill={c.a} />
      <Path d="M96 60 L72 72 L60 60Z" fill={c.b} />
      <Path d="M60 96 L72 72 L60 60Z" fill={c.b} />
      <Path d="M60 96 L48 72 L60 60Z" fill={c.a} />
      <Path d="M24 60 L48 72 L60 60Z" fill={c.b} />
      <Path d="M24 60 L48 48 L60 60Z" fill={c.a} />
    </Svg>
  );
}

function Wordmark({ size }: { size: number }) {
  return (
    <Text style={[styles.logoText, { fontSize: size }]}>
      <Text style={{ color: C.ink }}>your</Text>
      <Text style={{ color: C.brand }}>way</Text>
      <Text style={{ color: C.faint }}>.uz</Text>
    </Text>
  );
}

// Длинные абзацы делятся на несколько Text-блоков (ТЗ аудита §9) — та же логика, что в web-версии.
function Prose({ children, style }: { children: string; style?: StyleProp }) {
  const paragraphs = splitIntoParagraphs(children);
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text key={i} style={[styles.body, style, i > 0 ? { marginTop: 6 } : undefined]}>
          {p}
        </Text>
      ))}
    </>
  );
}

// Заголовок раздела не остаётся один внизу страницы: minPresenceAhead переносит его на следующую
// страницу, если после него не помещается хотя бы начало содержимого.
function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.sectionHeadRow} wrap={false} minPresenceAhead={60}>
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>{n}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Bullets({ items, color }: { items: string[]; color: string }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem} wrap={false}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function Checklist({ items }: { items: { text: string; note?: string; noteLabel?: string }[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={[styles.card, { flexDirection: "row", gap: 9, marginTop: 6, padding: 10 }]} wrap={false}>
          <View style={styles.checkbox} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.body, styles.bold]}>{item.text}</Text>
            {item.note && (
              <Text style={[styles.bodyMuted, { marginTop: 3 }]}>
                {item.noteLabel && <Text style={[styles.bold, { color: C.ink }]}>{item.noteLabel}: </Text>}
                {item.note}
              </Text>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

const ROUTE_KICKER: Record<ReportRoute["type"], string> = { local_cheap: C.brand, online: C.teal, abroad: C.sunInk };

function RouteBlock({ route, t, main }: { route: ReportRoute; t: ReportDict; main: boolean }) {
  const n = route.steps.length;
  const dot = (i: number) => (i === n - 1 ? C.sun : i === n - 2 && n > 2 ? C.teal : C.brand);
  return (
    // Без wrap={false} на всей карточке: длинный маршрут может не поместиться на одну страницу,
    // и react-pdf вместо переноса «ломает» вёрстку. Мелкие части внутри — неразрывные.
    <View style={[styles.card, { marginTop: 10, borderColor: main ? C.brand : C.line, borderWidth: main ? 1.5 : 1 }]}>
      <View wrap={false}>
        <Text style={[styles.label, { color: ROUTE_KICKER[route.type] }]}>{t.routeTypes[route.type].toUpperCase()}</Text>
        <Text style={[display, { fontSize: 12, marginTop: 3, lineHeight: 1.25 }]}>{route.title}</Text>
        <View style={styles.pillRow}>
          <Text style={styles.pill}>
            <Text style={styles.bold}>{t.time}: </Text>
            {route.time_estimate}
          </Text>
          <Text style={styles.pill}>
            <Text style={styles.bold}>{t.cost}: </Text>
            {route.cost_range}
          </Text>
          <Text
            style={[
              styles.pill,
              route.effort_level === "hard"
                ? { backgroundColor: C.brand50, color: C.brand700 }
                : { backgroundColor: C.teal50, color: C.teal },
              styles.bold,
            ]}
          >
            {t.effort[route.effort_level]}
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { marginTop: 10 }]} minPresenceAhead={30}>
        {t.steps.toUpperCase()}
      </Text>
      <View style={{ marginTop: 2 }}>
        {route.steps.map((step, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }} wrap={false}>
            {/* Таймлайн: точка и вертикальная линия до следующего шага. */}
            <View style={{ width: 8, alignItems: "center" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot(i), marginTop: 4 }} />
              {i < n - 1 && <View style={{ width: 1.2, flexGrow: 1, backgroundColor: C.line, marginTop: 2 }} />}
            </View>
            <Text style={[styles.listText, { paddingBottom: 6 }]}>{step}</Text>
          </View>
        ))}
      </View>
      {route.requirements.length > 0 && (
        <>
          <Text style={[styles.label, { marginTop: 6 }]} minPresenceAhead={30}>
            {t.requirements.toUpperCase()}
          </Text>
          <Bullets items={route.requirements} color={C.ink} />
        </>
      )}
      <View style={[styles.softBox, { backgroundColor: C.sand }]} wrap={false}>
        <Text style={styles.label}>{t.outcome.toUpperCase()}</Text>
        <Text style={[styles.body, { marginTop: 3 }]}>{route.outcome}</Text>
      </View>
      <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
        <Text style={[styles.bold, { color: C.ink }]}>{t.tradeoff}: </Text>
        {route.tradeoff_note}
      </Text>
      {route.what_to_check && (
        <View style={[styles.softBox, { backgroundColor: C.teal50 }]} wrap={false}>
          <Text style={[styles.bodyMuted, { color: C.ink }]}>
            <Text style={styles.bold}>{t.whatToCheck}: </Text>
            {route.what_to_check}
          </Text>
        </View>
      )}
    </View>
  );
}

// Кегль заголовка-цели на обложке — по длине (цель бывает и короткой, и целой фразой).
function coverTitleSize(text: string): number {
  if (text.length <= 40) return 34;
  if (text.length <= 90) return 26;
  if (text.length <= 160) return 20;
  return 16;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

export function ReportDocument({
  content,
  t,
  levelName,
  sixteenType,
  learningStyles,
  date,
  typeLabel,
  mockNote,
  languageNote,
  languageShort,
  summary,
}: ReportPdfProps) {
  const { portrait, goal, reality_check: reality, main_path: path, alternatives, act_now: actNow } = content;
  // plan_30_days — новое поле схемы (report-2.0, этап C1); у старых отчётов (report-1.0) его нет.
  const plan30Days = content.plan_30_days;
  let n = 0;
  const next = () => ++n;
  const verdictBox = {
    fits: { backgroundColor: C.teal50, color: C.ink },
    ambitious: { backgroundColor: C.sun100, color: C.sunInk },
    mismatch: { backgroundColor: C.brand50, color: C.brand700 },
  }[reality.verdict];

  return (
    <Document title={`${goal.statement} — yourway.uz`}>
      {/* Обложка */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverCircle} />
        <View style={styles.logoRow}>
          <Compass size={22} />
          <Wordmark size={17} />
        </View>
        <View style={styles.coverBody}>
          <Text style={styles.kicker}>{fmt(t.kicker, { level: levelName }).toUpperCase()}</Text>
          <Text style={[styles.coverTitle, { fontSize: coverTitleSize(goal.statement) }]}>{goal.statement}</Text>
          <View style={styles.typeBadge}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.teal800, alignItems: "center", justifyContent: "center" }}>
              <Compass size={26} variant="dark" />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.typeBadgeLabel}>{t.yourType.toUpperCase()}</Text>
              <Text style={styles.typeBadgeName}>{typeLabel}</Text>
              <Text style={styles.typeBadgeSub}>{sixteenType}</Text>
            </View>
          </View>
          {mockNote && <Text style={styles.coverMock}>{mockNote}</Text>}
        </View>
        <View style={styles.coverFooter}>
          <Text>{`${date} · ${languageShort}`}</Text>
          <Text>yourway.uz</Text>
        </View>
      </Page>

      {/* Внутренние страницы */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Compass size={10} />
          <Text style={styles.headerText}>{`yourway.uz · ${shorten(goal.statement, 80)}`}</Text>
          <Text style={styles.headerPage} render={({ pageNumber }) => `${pageNumber}`} />
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{t.disclaimer}</Text>
        </View>

        {/* Первый экран (ТЗ аудита §9): короткий вывод, направление, первый шаг и ограничения —
            та же логика, что на онлайн-странице отчёта. */}
        <View style={[styles.softBox, { backgroundColor: C.teal50, padding: 16, marginTop: 0 }]} wrap={false}>
          <Text style={[styles.label, { color: C.teal }]}>{t.firstScreen.title.toUpperCase()}</Text>
          <Prose style={{ marginTop: 5, fontSize: 11 }}>{summary.takeaway}</Prose>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 9 }}>
              <Text style={styles.label}>{t.firstScreen.directionLabel.toUpperCase()}</Text>
              <Text style={[styles.body, styles.bold, { marginTop: 3, fontSize: 10 }]}>{summary.direction}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 9 }}>
              <Text style={styles.label}>{t.firstScreen.firstStepLabel.toUpperCase()}</Text>
              <Text style={[styles.body, styles.bold, { marginTop: 3, fontSize: 10 }]}>{summary.firstStep}</Text>
            </View>
          </View>
          {summary.constraints && (
            <Text style={[styles.bodyMuted, { marginTop: 8, color: C.ink }]}>
              <Text style={styles.bold}>{t.firstScreen.constraintsLabel}: </Text>
              {summary.constraints}
            </Text>
          )}
        </View>
        <Text style={[styles.bodyMuted, { marginTop: 8, fontSize: 8.5 }]}>{languageNote}</Text>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.portrait} />
          <Prose>{portrait.summary}</Prose>
          {/* Сильные стороны и «на что обратить внимание» — друг под другом (на сайте — рядом):
              каждый блок неразрывный, так на странице не остаётся большой пустоты. */}
          <View style={[styles.softBox, { backgroundColor: C.teal50, marginTop: 10 }]} wrap={false}>
            <Text style={[styles.body, styles.bold, { color: C.teal, fontSize: 10 }]}>{t.strengths}</Text>
            <Bullets items={portrait.strengths} color={C.teal} />
          </View>
          <View style={[styles.softBox, { backgroundColor: C.sun100 }]} wrap={false}>
            <Text style={[styles.body, styles.bold, { color: C.sunInk, fontSize: 10 }]}>{t.watchouts}</Text>
            {portrait.watchouts.map((w, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.dot, { backgroundColor: C.sun }]} />
                <Text style={[styles.listText, { color: C.sunInk }]}>{w}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.goal} />
          <View style={styles.card} wrap={false}>
            <Text style={[styles.label, { color: C.brand }]}>{(goal.source === "stated" ? t.goalStated : t.goalConstructed).toUpperCase()}</Text>
            <Text style={[display, { fontSize: 12, marginTop: 4, lineHeight: 1.3 }]}>{goal.statement}</Text>
          </View>
          {goal.constructed_options.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>{t.options.toUpperCase()}</Text>
              {goal.constructed_options.map((o, i) => (
                <View key={i} style={[styles.card, { flexDirection: "row", gap: 9, marginTop: 6 }]} wrap={false}>
                  <View style={styles.numBox}>
                    <Text style={styles.numText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.body, styles.bold]}>{o.goal}</Text>
                    <Text style={[styles.bodyMuted, { marginTop: 2 }]}>{o.why_fits}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.reality} />
          <View style={[styles.softBox, { backgroundColor: verdictBox.backgroundColor }]}>
            <Text style={[display, { fontSize: 12, color: verdictBox.color }]}>{t.verdicts[reality.verdict]}</Text>
            <Prose style={{ marginTop: 5, color: verdictBox.color }}>{reality.explanation}</Prose>
          </View>
          {reality.adjustment && (
            <View style={styles.card}>
              <Text style={[styles.body, styles.bold]}>{t.adjustment}</Text>
              <Prose style={{ marginTop: 3 }}>{reality.adjustment}</Prose>
            </View>
          )}
          <Text style={[styles.bodyMuted, styles.bold, { marginTop: 6 }]}>{t.choiceIsYours}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.path} />
          <Prose>{path.summary}</Prose>
          <Text style={[styles.bodyMuted, { marginTop: 6 }]}>{t.routesNote}</Text>
          {path.routes.map((route, i) => (
            <RouteBlock key={i} route={route} t={t} main={i === 0 && path.routes.length > 1} />
          ))}
        </View>

        {plan30Days && plan30Days.length > 0 && (
          <View style={styles.section}>
            <SectionTitle n={next()} title={t.sections.plan30} />
            <Checklist items={plan30Days.map((p) => ({ text: p.task, note: p.expected_result, noteLabel: t.plan30Result }))} />
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.learning} />
          {learningStyles.length > 0 && (
            <Text style={[styles.pill, { alignSelf: "flex-start", backgroundColor: C.brand50, color: C.brand700, marginBottom: 7 }, styles.bold]}>
              {fmt(t.yourStyle, { style: learningStyles.join(" + ") })}
            </Text>
          )}
          <Prose>{path.learning_advice}</Prose>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.future} />
          <View style={[styles.softBox, { backgroundColor: C.sand, marginTop: 0 }]}>
            <Prose>{path.future_outlook}</Prose>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.alternatives} />
          {alternatives.map((alt, i) => {
            const tone = i % 2 === 0 ? C.brand : C.teal;
            return (
              <View key={i} style={[styles.card, { padding: 0, marginTop: 10 }]}>
                <View style={{ height: 5, backgroundColor: tone, borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
                <View style={{ padding: 12 }}>
                  <Text style={[display, { fontSize: 13, lineHeight: 1.2 }]}>{alt.direction}</Text>
                  <Text style={[styles.label, { color: tone, marginTop: 8 }]}>{t.whyYou.toUpperCase()}</Text>
                  <Text style={[styles.body, { marginTop: 2 }]}>{alt.why_you}</Text>
                  <Text style={[styles.label, { color: tone, marginTop: 8 }]}>{t.potential.toUpperCase()}</Text>
                  <Text style={[styles.body, { marginTop: 2 }]}>{alt.potential}</Text>
                  <Text style={[styles.label, { color: tone, marginTop: 8 }]} minPresenceAhead={30}>
                    {t.firstSteps.toUpperCase()}
                  </Text>
                  {alt.first_steps.map((s, j) => (
                    <View key={j} style={[styles.listItem, { gap: 8 }]} wrap={false}>
                      <View style={[styles.numBox, { backgroundColor: C.sand }]}>
                        <Text style={[styles.numText, { color: C.ink }]}>{j + 1}</Text>
                      </View>
                      <Text style={styles.listText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.actNow} />
          <Checklist items={actNow.map((text) => ({ text }))} />
        </View>

        <View style={[styles.softBox, { backgroundColor: C.sand, marginTop: 22 }]} wrap={false}>
          <Text style={[styles.body, styles.bold, { fontSize: 10 }]}>{t.disclaimerTitle}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 3 }]}>{content.disclaimer}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 3 }]}>{t.disclaimer}</Text>
        </View>
      </Page>
    </Document>
  );
}
