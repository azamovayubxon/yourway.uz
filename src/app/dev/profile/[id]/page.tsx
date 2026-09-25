import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageShell, PlaceholderNote } from "@/components/ui";
import type { Profile } from "@/lib/assessment/profile";
import { BIG_FIVE_SCALES, computeScores, countAnswered, type Scores } from "@/lib/assessment/scoring";
import { surveyQuestionsFor } from "@/lib/assessment/survey";
import { SCALE_NAMES, SCALE_ORDER, TOTAL_QUESTIONS, type PathType } from "@/lib/assessment/tests";
import { devToolsEnabled } from "@/lib/dev";
import { loadSession } from "@/lib/session";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Служебная страница: посчитанные баллы сессии. На боевом сайте отдаёт 404.
export default async function DevProfilePage({ params }: { params: Promise<{ id: string }> }) {
  if (!devToolsEnabled()) notFound();
  const session = await loadSession((await params).id);
  if (!session) notFound();

  const { locale, t } = await getI18n();
  const d = t.devProfile;
  const answered = countAnswered(session.answerMap);
  const scores: Scores | null =
    (session.scores as Scores | null) ?? (answered === TOTAL_QUESTIONS ? computeScores(session.answerMap) : null);

  const pathType = session.pathType as PathType;
  const surveyTotal = surveyQuestionsFor(pathType).length;
  const surveyAnswered = Object.keys(session.surveyAnswerMap).length;
  const profile = session.profile as Profile | null;

  const styleName = (s: string) => SCALE_NAMES.perception[s]?.[locale] ?? s;

  return (
    <PageShell title={d.title}>
      <PlaceholderNote>{d.note}</PlaceholderNote>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{d.session}</dt>
        <dd className="break-all font-mono">{session.id}</dd>
        <dt className="text-muted">{d.pathType}</dt>
        <dd className="font-mono">{session.pathType}</dd>
        <dt className="text-muted">{d.status}</dt>
        <dd className="font-mono">{session.status}</dd>
        <dt className="text-muted">{d.answered}</dt>
        <dd>
          {answered} / {TOTAL_QUESTIONS}
        </dd>
      </dl>

      {!scores ? (
        <p className="text-muted">{d.notDone}</p>
      ) : (
        <>
          <Card title={d.bigFive}>
            <ul className="space-y-3">
              {BIG_FIVE_SCALES.map((scale) => (
                <li key={scale}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                    <span className="font-semibold">{d.bigFiveNames[scale]}</span>
                    <span className="text-muted">
                      <b className="text-ink">{scores.big_five[scale]}%</b> · {d.levels[scores.big_five_levels[scale]]} · {d.rawSum}{" "}
                      {scores.big_five_raw[scale]}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${scores.big_five[scale]}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={d.sixteenType}>
            <p className="text-lg">
              <b>{scores.sixteen_type.code}</b> — {scores.sixteen_type.nickname[locale]}
            </p>
            <p className="mt-1 text-sm text-muted">
              {d.weakAxes}: {scores.sixteen_type.weak_axes.join(", ") || d.none}
            </p>
          </Card>

          <Card title={d.riasec}>
            <p className="text-lg">
              {d.code}: <b>{scores.riasec.code}</b>
            </p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {/* Порядок R→I→A→S→E→C: база (JSONB) не сохраняет порядок ключей. */}
              {SCALE_ORDER.riasec.map((type) => (
                <li key={type}>
                  <b>{type}</b> {SCALE_NAMES.riasec[type]?.[locale]}: {scores.riasec.scores[type]}
                </li>
              ))}
            </ul>
          </Card>

          <Card title={d.values}>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm">
              {scores.values_ranked.map((v) => (
                <li key={v}>
                  {SCALE_NAMES.values[v]?.[locale]} <span className="font-mono text-muted">({v})</span> —{" "}
                  {scores.values_scores[v]} {d.points}
                </li>
              ))}
            </ol>
          </Card>

          <Card title={d.learningStyle}>
            <p className="text-lg font-bold">
              {(Array.isArray(scores.learning_style) ? scores.learning_style : [scores.learning_style]).map(styleName).join(" + ")}
            </p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {SCALE_ORDER.perception.map((s) => (
                <li key={s}>
                  {styleName(s)}: {scores.learning_style_scores[s]}
                </li>
              ))}
            </ul>
          </Card>

          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold">{d.json}</summary>
            <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(scores, null, 2)}</pre>
          </details>

          <Card title={d.surveyTitle}>
            <p>
              {d.answered}: {surveyAnswered} / {surveyTotal}
            </p>
          </Card>

          {!profile ? (
            <p className="text-muted">{d.profileNotDone}</p>
          ) : (
            <>
              <Card title={d.profileTitle}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">{d.languageLabel}</dt>
                  <dd className="font-mono">{profile.language}</dd>
                  <dt className="text-muted">{d.level}</dt>
                  <dd className="font-mono">{profile.level}</dd>
                  <dt className="text-muted">{d.answerQuality}</dt>
                  <dd>{profile.answer_quality ? fmtAnswerQuality(d.answerQualityLow, profile.answer_quality.tests) : d.answerQualityOk}</dd>
                </dl>

                <h3 className="mt-4 font-semibold">{d.demographics}</h3>
                <KeyValueList data={profile.demographics} />

                <h3 className="mt-4 font-semibold">{d.resources}</h3>
                <KeyValueList data={profile.resources} />

                {profile.goal && (
                  <>
                    <h3 className="mt-4 font-semibold">{d.goal}</h3>
                    <KeyValueList data={profile.goal} />
                  </>
                )}
              </Card>

              <details className="rounded-2xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold">{d.profileJson}</summary>
                <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(profile, null, 2)}</pre>
              </details>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function fmtAnswerQuality(template: string, tests: string[]): string {
  return template.replace("{tests}", tests.join(", "));
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  return (
    <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
      {Object.entries(data).map(([key, value]) => (
        <li key={key}>
          <span className="font-mono text-muted">{key}</span>: {Array.isArray(value) ? value.join(", ") : String(value)}
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}
