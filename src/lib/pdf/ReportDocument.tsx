// Брендированный PDF полного отчёта (этап 7). Та же структура, что у онлайн-страницы (ReportView),
// но без интерактивности (details/summary → полностью раскрытый текст) — потому что PDF читают
// и печатают, в том числе показывают родителям (условие из задачи). Кириллица и узбекская латиница
// (oʻ gʻ, ʼ) — через шрифт Noto Sans (src/lib/pdf/fonts.ts).

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";
import type { ReportContent, ReportRoute } from "@/lib/ai/report-schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { PDF_FONT_FAMILY } from "./fonts";

type ReportDict = Dictionary["report"];

export interface ReportPdfProps {
  content: ReportContent;
  t: ReportDict;
  levelName: string;
  sixteenType: string;
  learningStyles: string[];
  date: string;
  // Плашка «тестовый режим ИИ» (мок-режим) — как на онлайн-странице.
  mockNote: string | null;
  // Отчёт написан на другом языке, чем сейчас читает человек (решение (Л)) — как на онлайн-странице:
  // текст отчёта остаётся на языке генерации, а колонтитулы и подписи — на текущем языке интерфейса.
  otherLanguage: string | null;
}

const BRAND = "#2f6fed";
const BRAND_DARK = "#1a46a8";
const INK = "#14203a";
const MUTED = "#5b6780";
const BORDER = "#e2e8f0";
const PANEL = "#f8fafc";

const styles = StyleSheet.create({
  // lineHeight здесь намеренно не задаём (даже общий на всю страницу): в react-pdf 4.9 он ломает
  // текст с динамическим render (номер страницы в колонтитуле, ниже) — тот перестаёт печататься
  // без ошибки (баг библиотеки). У параграфов lineHeight задан отдельно, на самих стилях (body,
  // bodyMuted, listText, altText, coverGoal, coverTitle).
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10.5,
    color: INK,
    paddingTop: 90,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },
  // Колонтитулы (fixed — повторяются на каждой странице).
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    paddingHorizontal: 40,
    paddingTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerBrand: { fontSize: 11, fontWeight: "bold", color: BRAND_DARK },
  headerMeta: { fontSize: 9, color: MUTED },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    paddingHorizontal: 40,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: { fontSize: 8, color: MUTED },

  cover: {
    backgroundColor: BRAND,
    borderRadius: 14,
    padding: 22,
    marginBottom: 20,
  },
  coverKicker: { fontSize: 9, color: "#dbe6ff", fontWeight: "bold", letterSpacing: 1 },
  coverTitle: { fontSize: 22, fontWeight: "bold", color: "#ffffff", marginTop: 8, lineHeight: 1.15 },
  coverMetaRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  coverPill: {
    fontSize: 9,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  coverGoal: { fontSize: 11, color: "#ffffff", marginTop: 12, lineHeight: 1.4 },

  section: { marginTop: 16 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionNumber: { fontSize: 9, fontWeight: "bold", color: BRAND_DARK, width: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: INK },

  body: { fontSize: 10.5, color: INK, lineHeight: 1.5 },
  bodyMuted: { fontSize: 10, color: MUTED, lineHeight: 1.5 },
  label: { fontSize: 8.5, fontWeight: "bold", color: MUTED, letterSpacing: 0.6 },

  panel: { backgroundColor: PANEL, borderRadius: 10, padding: 12, marginTop: 8 },
  panelBordered: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginTop: 8 },

  strengthsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  strengthChip: {
    fontSize: 10,
    fontWeight: "bold",
    backgroundColor: "#eef6ff",
    color: BRAND_DARK,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },

  listItem: { flexDirection: "row", gap: 6, marginTop: 4 },
  listBullet: { fontSize: 10, color: BRAND_DARK, width: 10 },
  listText: { fontSize: 10, color: INK, flex: 1, lineHeight: 1.45 },

  optionCard: { flexDirection: "row", gap: 8, marginTop: 6 },
  optionNum: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: BRAND,
    width: 16,
    height: 16,
    borderRadius: 8,
    textAlign: "center",
    paddingTop: 3,
  },
  optionGoal: { fontSize: 10.5, fontWeight: "bold", color: INK },
  optionWhy: { fontSize: 9.5, color: MUTED, marginTop: 1 },

  verdictRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verdictTitle: { fontSize: 11, fontWeight: "bold", color: INK },

  routeCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginTop: 8 },
  routeHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  routeType: { fontSize: 8.5, fontWeight: "bold", color: BRAND_DARK },
  routeEffort: { fontSize: 8.5, fontWeight: "bold", color: MUTED },
  routeTitle: { fontSize: 11.5, fontWeight: "bold", color: INK, marginTop: 4 },
  routeStatsRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  routeStat: { flex: 1, backgroundColor: PANEL, borderRadius: 8, padding: 7 },
  routeStatLabel: { fontSize: 7.5, fontWeight: "bold", color: MUTED, letterSpacing: 0.4 },
  routeStatValue: { fontSize: 9.5, fontWeight: "bold", color: INK, marginTop: 2 },

  altCard: { backgroundColor: INK, borderRadius: 12, padding: 14, marginTop: 10 },
  altTitle: { fontSize: 13, fontWeight: "bold", color: "#ffffff" },
  altLabel: { fontSize: 8, fontWeight: "bold", color: "#c7d2fe", letterSpacing: 0.6, marginTop: 8 },
  altText: { fontSize: 10, color: "#e5e9f5", marginTop: 2, lineHeight: 1.45 },

  checklistItem: { flexDirection: "row", gap: 8, marginTop: 6, alignItems: "flex-start" },
  checkbox: { width: 10, height: 10, borderWidth: 1.3, borderColor: BRAND_DARK, borderRadius: 2, marginTop: 1 },

  disclaimer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  mockNote: {
    fontSize: 8.5,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 8,
    marginBottom: 14,
  },
  otherLangNote: {
    fontSize: 8.5,
    color: MUTED,
    backgroundColor: PANEL,
    borderRadius: 8,
    padding: 8,
    marginBottom: 14,
  },
});

const ROUTE_TYPE_LABEL: Record<ReportRoute["type"], (t: ReportDict) => string> = {
  local_cheap: (t) => t.routeTypes.local_cheap,
  abroad: (t) => t.routeTypes.abroad,
  online: (t) => t.routeTypes.online,
};

function Prose({ children, style }: { children: string; style?: StyleProp }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.sectionHeadRow}>
      <Text style={styles.sectionNumber}>{String(n).padStart(2, "0")}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function RouteCard({ route, t }: { route: ReportRoute; t: ReportDict }) {
  const hard = route.effort_level === "hard";
  return (
    // Без wrap={false}: у длинных карточек (много шагов) содержимое может не поместиться на одну
    // страницу целиком, и react-pdf вместо переноса «ломает» вёрстку (текст наезжает друг на друга).
    <View style={styles.routeCard}>
      <View style={styles.routeHeadRow}>
        <Text style={styles.routeType}>{ROUTE_TYPE_LABEL[route.type](t).toUpperCase()}</Text>
        <Text style={[styles.routeEffort, hard ? { color: "#b45309" } : undefined]}>
          {t.effort[route.effort_level].toUpperCase()}
        </Text>
      </View>
      <Text style={styles.routeTitle}>{route.title}</Text>
      <View style={styles.routeStatsRow}>
        <View style={styles.routeStat}>
          <Text style={styles.routeStatLabel}>{t.time.toUpperCase()}</Text>
          <Text style={styles.routeStatValue}>{route.time_estimate}</Text>
        </View>
        <View style={styles.routeStat}>
          <Text style={styles.routeStatLabel}>{t.cost.toUpperCase()}</Text>
          <Text style={styles.routeStatValue}>{route.cost_range}</Text>
        </View>
      </View>
      <Text style={[styles.label, { marginTop: 10 }]}>{t.steps.toUpperCase()}</Text>
      {route.steps.map((step, i) => (
        <View key={i} style={styles.listItem}>
          {/* Ширина шире, чем у styles.listBullet: двузначные номера (шагов может быть больше 9)
              иначе переносятся внутри узкой колонки — "10." ломается на "10-" и "." строкой ниже. */}
          <Text style={[styles.listBullet, { width: 16 }]}>{i + 1}.</Text>
          <Text style={styles.listText}>{step}</Text>
        </View>
      ))}
      {route.requirements.length > 0 && (
        <>
          <Text style={[styles.label, { marginTop: 8 }]}>{t.requirements.toUpperCase()}</Text>
          {route.requirements.map((r, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listText}>{r}</Text>
            </View>
          ))}
        </>
      )}
      <View style={[styles.panel, { marginTop: 8 }]}>
        <Text style={styles.label}>{t.outcome.toUpperCase()}</Text>
        <Text style={[styles.body, { marginTop: 3 }]}>{route.outcome}</Text>
      </View>
      <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
        <Text style={{ fontWeight: "bold", color: INK }}>{t.tradeoff}: </Text>
        {route.tradeoff_note}
      </Text>
    </View>
  );
}

export function ReportDocument({
  content,
  t,
  levelName,
  sixteenType,
  learningStyles,
  date,
  mockNote,
  otherLanguage,
}: ReportPdfProps) {
  const { portrait, goal, reality_check: reality, main_path: path, alternatives, act_now: actNow } = content;
  let n = 0;
  const next = () => ++n;

  return (
    <Document title={`${portrait.type_label} — yourway.uz`}>
      <Page size="A4" style={styles.page} wrap>
        {mockNote && <Text style={styles.mockNote}>{mockNote}</Text>}
        {otherLanguage && <Text style={styles.otherLangNote}>{otherLanguage}</Text>}

        <View style={styles.cover}>
          <Text style={styles.coverKicker}>{fmt(t.kicker, { level: levelName }).toUpperCase()}</Text>
          <Text style={styles.coverTitle}>{portrait.type_label}</Text>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverPill}>{sixteenType}</Text>
            <Text style={styles.coverPill}>{date}</Text>
          </View>
          <Text style={styles.coverGoal}>{goal.statement}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.portrait} />
          <Prose>{portrait.summary}</Prose>
          <Text style={[styles.label, { marginTop: 10 }]}>{t.strengths.toUpperCase()}</Text>
          <View style={styles.strengthsGrid}>
            {portrait.strengths.map((s) => (
              <Text key={s} style={styles.strengthChip}>
                {s}
              </Text>
            ))}
          </View>
          <View style={styles.panelBordered}>
            <Text style={[styles.label, { color: "#92400e" }]}>{t.watchouts.toUpperCase()}</Text>
            {portrait.watchouts.map((w) => (
              <View key={w} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: "#92400e" }]}>•</Text>
                <Text style={styles.listText}>{w}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.goal} />
          <View style={styles.panelBordered}>
            <Text style={styles.label}>{(goal.source === "stated" ? t.goalStated : t.goalConstructed).toUpperCase()}</Text>
            <Text style={[styles.body, { fontWeight: "bold", marginTop: 4 }]}>{goal.statement}</Text>
          </View>
          {goal.constructed_options.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>{t.options.toUpperCase()}</Text>
              {goal.constructed_options.map((o, i) => (
                <View key={o.goal} style={styles.optionCard}>
                  <Text style={styles.optionNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionGoal}>{o.goal}</Text>
                    <Text style={styles.optionWhy}>{o.why_fits}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.reality} />
          <View style={styles.panel}>
            <View style={styles.verdictRow}>
              <Text style={styles.verdictTitle}>{t.verdicts[reality.verdict]}</Text>
            </View>
            <Prose style={{ marginTop: 6 }}>{reality.explanation}</Prose>
          </View>
          {reality.adjustment && (
            <View style={styles.panelBordered}>
              <Text style={styles.label}>{t.adjustment.toUpperCase()}</Text>
              <Prose style={{ marginTop: 4 }}>{reality.adjustment}</Prose>
            </View>
          )}
          <Text style={[styles.bodyMuted, { marginTop: 6, fontWeight: "bold" }]}>{t.choiceIsYours}</Text>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.path} />
          <Prose>{path.summary}</Prose>
          <Text style={[styles.label, { marginTop: 10 }]}>{t.routesTitle.toUpperCase()}</Text>
          <Text style={styles.bodyMuted}>{t.routesNote}</Text>
          {path.routes.map((route, i) => (
            <RouteCard key={i} route={route} t={t} />
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.learning} />
          {learningStyles.length > 0 && (
            <Text style={[styles.strengthChip, { alignSelf: "flex-start", marginBottom: 6 }]}>
              {learningStyles.join(" + ")}
            </Text>
          )}
          <Prose>{path.learning_advice}</Prose>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.future} />
          <View style={styles.panel}>
            <Prose>{path.future_outlook}</Prose>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.alternatives} />
          {alternatives.map((alt) => (
            <View key={alt.direction} style={styles.altCard}>
              <Text style={styles.altTitle}>{alt.direction}</Text>
              <Text style={styles.altLabel}>{t.whyYou.toUpperCase()}</Text>
              <Text style={styles.altText}>{alt.why_you}</Text>
              <Text style={styles.altLabel}>{t.potential.toUpperCase()}</Text>
              <Text style={styles.altText}>{alt.potential}</Text>
              <Text style={styles.altLabel}>{t.firstSteps.toUpperCase()}</Text>
              {alt.first_steps.map((s, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 6, marginTop: 3 }}>
                  <Text style={[styles.altText, { width: 12 }]}>{i + 1}.</Text>
                  <Text style={[styles.altText, { flex: 1 }]}>{s}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionTitle n={next()} title={t.sections.actNow} />
          {actNow.map((step, i) => (
            <View key={i} style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.disclaimer} wrap={false}>
          <Text style={[styles.label]}>{t.disclaimerTitle.toUpperCase()}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 4 }]}>{content.disclaimer}</Text>
          <Text style={[styles.bodyMuted, { marginTop: 4 }]}>{t.disclaimer}</Text>
        </View>

        <View style={styles.header} fixed>
          <Text style={styles.headerBrand}>yourway.uz</Text>
          <Text style={styles.headerMeta}>{sixteenType}</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={[styles.footerText, { flex: 1 }]}>{`yourway.uz · ${date}`}</Text>
          <Text
            style={[styles.footerText, { width: 60, textAlign: "right" }]}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
