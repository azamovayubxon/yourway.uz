import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PlaceholderNote } from "@/components/ui";
import { getDb } from "@/lib/db";
import { devToolsEnabled } from "@/lib/dev";
import { summarizeTeaserDurations } from "@/lib/teaser/ai-log";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

// Сколько последних вызовов показывать списком и по скольким тизерам считать среднее.
const LIST_SIZE = 20;
const SUMMARY_TEASERS = 20;

const seconds = (ms: number) => (ms / 1000).toFixed(1);

// Служебная страница: журнал вызовов ИИ (время, язык, модель, длительность, результат проверки,
// текст ответа) и средняя длительность тизера по языкам. На боевом сайте отдаёт 404.
export default async function AiLogPage() {
  if (!devToolsEnabled()) notFound();
  const { t } = await getI18n();
  const d = t.devAiLog;
  const db = getDb();

  const [calls, recentForSummary] = await Promise.all([
    db.aiCall.findMany({ orderBy: { createdAt: "desc" }, take: LIST_SIZE }),
    db.aiCall.findMany({
      where: { kind: "teaser" },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_TEASERS * 2 * 3,
      select: { teaserId: true, locale: true, durationMs: true, ok: true, createdAt: true },
    }),
  ]);
  const summary = summarizeTeaserDurations(recentForSummary, SUMMARY_TEASERS);
  const langName = (locale: string | null) =>
    locale && locale in d.languageNames ? d.languageNames[locale as keyof typeof d.languageNames] : (locale ?? "—");

  return (
    <PageShell title={d.title}>
      <PlaceholderNote>{d.note}</PlaceholderNote>

      {calls.length === 0 ? (
        <p className="text-muted">{d.empty}</p>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="font-bold">{d.summaryTitle}</h2>
            <p className="mt-1 text-sm text-muted">{fmt(d.summaryNote, { n: SUMMARY_TEASERS })}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {summary.map((s) => (
                <li key={s.locale}>
                  {fmt(d.summaryRow, {
                    lang: langName(s.locale),
                    avg: seconds(s.avgMs),
                    max: seconds(s.maxMs),
                    ok: s.ok,
                    total: s.teasers,
                    retried: s.retried,
                  })}
                </li>
              ))}
            </ul>
          </section>

          <h2 className="mt-8 font-bold">{d.listTitle}</h2>
          <ul className="mt-3 space-y-3">
            {calls.map((call) => {
              const problems = Array.isArray(call.problems) ? (call.problems as string[]) : [];
              return (
                <li
                  key={call.id}
                  className={
                    "rounded-2xl border p-4 text-sm " + (call.ok ? "border-emerald-200" : "border-amber-300 bg-amber-50/40")
                  }
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-muted">{call.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</span>
                    <span className="font-semibold">{langName(call.locale)}</span>
                    <span className="text-muted">· {call.kind} · {fmt(d.attempt, { n: call.attempt })}</span>
                    <span className={"ml-auto font-bold " + (call.ok ? "text-emerald-700" : "text-amber-700")}>
                      {call.ok ? d.accepted : d.rejected}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1">
                    <Row label={d.model} value={call.model} mono />
                    <Row label={d.duration} value={fmt(d.seconds, { s: seconds(call.durationMs) })} />
                    <Row label={d.tokens} value={`${call.inputTokens} / ${call.outputTokens} / ${call.cacheReadTokens}`} mono />
                    <Row label={d.cost} value={call.costUsd === null ? "—" : `$${call.costUsd.toFixed(4)}`} mono />
                    {call.error && <Row label={d.error} value={call.error} mono />}
                  </dl>
                  {problems.length > 0 && (
                    <div className="mt-2">
                      <p className="text-muted">{d.problems}:</p>
                      <ul className="ml-5 list-disc">
                        {problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer py-1 font-semibold text-brand-600">{d.response}</summary>
                    {call.responseText ? (
                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-xs">
                        {prettyJson(call.responseText)}
                      </pre>
                    ) : (
                      <p className="mt-1 text-muted">{d.noResponse}</p>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PageShell>
  );
}

// Строка «название: значение». На узком экране значение уходит под название, а не сжимается в столбик.
function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted">{label}:</dt>
      <dd className={"min-w-0 break-words" + (mono ? " font-mono" : "")}>{value}</dd>
    </div>
  );
}

// Ответ ИИ — обычно JSON в одну строку; для чтения разворачиваем его с отступами.
function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
