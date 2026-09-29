import type { Metadata } from "next";
import Link from "next/link";
import { TeaserView } from "@/app/teaser/TeaserView";
import { ReportView, type SectionId } from "@/app/report/[id]/ReportView";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { getAiMode, mockReportPart } from "@/lib/ai/providers";
import { mergeReportParts, type ReportContent } from "@/lib/ai/report-schema";
import type { TeaserContent } from "@/lib/ai/teaser-schema";
import type { Profile } from "@/lib/assessment/profile";
import { getComparison, listComparisons, tokenGuesses, type ComparisonRow } from "@/lib/compare";
import {
  COMPARE_KIND_LABELS,
  COMPARE_PART_LABELS,
  summarizeWins,
  VERDICT_LABELS,
  type CompareKind,
  type ComparePart,
  type CompareVerdict,
} from "@/lib/compare/logic";
import { presentReport, reportLanguageNote } from "@/lib/report/present";
import { getDictionary } from "@/i18n/dictionaries";
import { AdminShell, Card, DataTable, Notice } from "../ui";
import { rateComparisonAction } from "./actions";
import { CompareForm } from "./CompareForm";
import { CompareRunner } from "./CompareRunner";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

// Слепое сравнение моделей ИИ (только superadmin): владелец — носитель узбекского — выбирает, какая
// модель лучше пишет по-узбекски. Одна и та же генерация двумя моделями через боевые промпты и
// проверки; на экране «Variant 1 / Variant 2» в случайном порядке и в том же оформлении, что видит
// пользователь. Какая модель какая, сколько времени и денег ушло — только после оценки.

const START_ERRORS: Record<string, string> = {
  bad_input: "Заполните все поля формы.",
  session_not_found: "Сессия не найдена или ещё не завершена (нужен пройденный опрос и собранный профиль).",
  openai_key: "Для модели OpenAI нужен ключ OPENAI_API_KEY в окружении сайта — его сейчас нет.",
  bad_name: "В названии модели допустимы только латинские буквы, цифры, точка, дефис, двоеточие и «_».",
  rate_limit: "Слишком много сравнений подряд — не больше 20 в час. Подождите и попробуйте снова.",
  no_verdict: "Отметьте, какой вариант лучше (или «одинаково»).",
};

const PART_SECTIONS: Record<ComparePart, SectionId[]> = {
  portrait_goal: ["portrait", "goal", "reality"],
  main_path: ["path"],
  finish: ["plan30", "learning", "future", "alternatives", "actNow"],
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} с`;
const money = (v: number | null) => (v === null ? "цена неизвестна" : `$${v.toFixed(4)}`);

function kindLabel(kind: string, part: string | null): string {
  const base = COMPARE_KIND_LABELS[kind as CompareKind] ?? kind;
  return part ? `${base} · ${part}` : base;
}

export default async function AdminComparePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const comparison = params.id ? await getComparison(params.id) : null;
  const [history, guesses] = await Promise.all([listComparisons(), tokenGuesses()]);
  const scores = summarizeWins(history);
  const mock = getAiMode() === "mock";

  return (
    <AdminShell title="Сравнение моделей" isSuperAdmin={admin.role === "superadmin"}>
      {params.error && <Notice kind="error">{START_ERRORS[params.error] ?? "Не получилось — попробуйте ещё раз."}</Notice>}

      {comparison ? (
        <ComparisonView comparison={comparison} />
      ) : (
        <Card title="Новое сравнение">
          <p className="mb-4 text-sm text-muted">
            Одна и та же генерация на узбекском двумя моделями — через те же промпты (активная версия из «Промпты и
            модели»), правила узбекского и проверки, что и на сайте. Пользователям ничего не создаётся, лимиты не
            тратятся; вызовы видны в «Себестоимости ИИ» с пометкой «сравнение моделей». Страховки на Claude здесь
            нет: если модель не справилась, это будет видно.
          </p>
          <CompareForm tokenGuesses={guesses} mock={mock} />
        </Card>
      )}

      <Card title="Сводка: какая модель сколько раз выиграла">
        {scores.length === 0 ? (
          <p className="text-sm text-muted">Оценённых сравнений пока нет.</p>
        ) : (
          <div data-testid="compare-summary">
            <DataTable
              head={["Модель", "Сравнений", "Побед", "Поражений", "Одинаково"]}
              rows={scores.map((s) => [
                <span key="m" className="font-mono text-xs">
                  {s.model}
                </span>,
                String(s.comparisons),
                String(s.wins),
                String(s.losses),
                String(s.ties),
              ])}
            />
          </div>
        )}
        {history.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 font-bold">Последние сравнения</h3>
            <DataTable
              head={["Когда", "Что", "Профиль", "Модели", "Оценка", ""]}
              rows={history.slice(0, 30).map((c) => [
                c.createdAt.toISOString().slice(0, 16).replace("T", " "),
                kindLabel(c.kind, c.part),
                <span key="p" className="font-mono text-xs">
                  {c.profileSource}
                </span>,
                // До оценки модели не показываем и здесь — иначе сравнение перестанет быть слепым.
                c.verdict ? (
                  <span key="m" className="font-mono text-xs">
                    {[...c.variants].sort((a, b) => a.slot - b.slot).map((v) => `${v.slot}: ${v.model}`).join(" · ")}
                  </span>
                ) : (
                  <span key="m" className="text-muted">скрыты до оценки</span>
                ),
                c.verdict ? VERDICT_LABELS[c.verdict as CompareVerdict] ?? c.verdict : "не оценено",
                <Link key="l" href={`/admin/compare?id=${c.id}`} className="font-semibold text-brand-600">
                  открыть
                </Link>,
              ])}
            />
          </>
        )}
      </Card>
    </AdminShell>
  );
}

function ComparisonView({ comparison }: { comparison: ComparisonRow }) {
  const inProgress = comparison.variants.some((v) => v.status === "pending" || v.status === "generating");
  const rated = comparison.verdict !== null;

  return (
    <>
      <Card title={kindLabel(comparison.kind, comparison.part)}>
        <p className="text-sm text-muted">
          Профиль: <span className="font-mono">{comparison.profileSource}</span> · версия промпта{" "}
          <span className="font-mono">{comparison.promptVersion}</span> · запущено{" "}
          {comparison.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC ({comparison.createdBy})
          {comparison.part && <> · {COMPARE_PART_LABELS[comparison.part as ComparePart]}</>}
        </p>
        <p className="mt-2">
          <Link href="/admin/compare" className="text-sm font-semibold text-brand-600">
            ← Новое сравнение
          </Link>
        </p>
      </Card>

      {inProgress ? (
        <CompareRunner
          id={comparison.id}
          initial={{
            variants: comparison.variants.map((v) => ({
              slot: v.slot,
              status: v.status === "ready" ? "ready" : v.status === "failed" ? "failed" : "generating",
            })),
            done: false,
          }}
        />
      ) : (
        <>
          <nav className="flex flex-wrap gap-2 text-sm font-semibold">
            {comparison.variants.map((v) => (
              <a key={v.slot} href={`#variant-${v.slot}`} className="rounded-xl border-2 border-slate-200 px-3 py-2">
                Variant {v.slot}
              </a>
            ))}
            <a href="#rating" className="rounded-xl border-2 border-slate-200 px-3 py-2">
              Оценка
            </a>
          </nav>
          {comparison.variants.map((v) => (
            <section key={v.slot} id={`variant-${v.slot}`} className="scroll-mt-4 rounded-3xl border-2 border-slate-200">
              <h2 className="rounded-t-3xl bg-slate-100 px-5 py-3 text-lg font-extrabold">Variant {v.slot}</h2>
              <VariantBody comparison={comparison} variant={v} />
            </section>
          ))}
          {rated ? <Reveal comparison={comparison} /> : <RatingForm id={comparison.id} />}
        </>
      )}
    </>
  );
}

type Variant = ComparisonRow["variants"][number];

// Текст варианта в том же оформлении, что видит пользователь (компоненты страницы тизера и отчёта),
// с узбекским интерфейсом вокруг — как у человека, который выбрал узбекский.
function VariantBody({ comparison, variant }: { comparison: ComparisonRow; variant: Variant }) {
  const t = getDictionary("uz");
  const problems = Array.isArray(variant.problems) ? (variant.problems as unknown[]).map(String) : [];
  const failed = variant.status === "failed";
  const mockBadge = comparison.aiMode === "mock" ? { label: t.teaser.mockBadge, note: t.teaser.mockNote } : null;
  const profile = comparison.profile as unknown as Profile;

  const notice = (failed || problems.length > 0) && (
    <div className={"m-4 rounded-xl px-4 py-3 text-sm " + (failed ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900")}>
      <p className="font-bold">
        {failed
          ? "Ответ не прошёл проверки сайта (после повтора) — пользователь такой текст не увидел бы."
          : "Принято с предупреждением (как на сайте на последней попытке) — замечания проверки:"}
      </p>
      {variant.error && failed && <p className="mt-1 font-mono text-xs">{variant.error}</p>}
      {problems.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-xs">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!variant.content) return <>{notice}</>;

  if (comparison.kind === "teaser") {
    const presentation = presentReport({ level: profile.level, createdAt: comparison.createdAt, profile }, "uz", t);
    return (
      <>
        {notice}
        <TeaserView
          t={t.teaser}
          content={variant.content as unknown as TeaserContent}
          teaserLocale="uz"
          mock={mockBadge !== null}
          sixteenType={presentation.sixteenType}
          riasecScores={profile.riasec.scores}
          shareActions={null}
          features={t.checkout.levels[profile.level].features}
          recommendedLevel={profile.level}
          recommendedPrice={null}
          sumTemplate={t.common.sum}
          lowQuality={false}
          otherLanguage={null}
          unlockHref="#rating"
          reportHref={null}
          footer={null}
        />
      </>
    );
  }

  const part = comparison.part as ComparePart;
  const level = comparison.kind === "report_navigator" ? "navigator" : "route";
  const pathType = profile.path_type;
  // Остальные части — из образца (они не показываются, нужны только чтобы собрать отчёт целиком).
  const parts = {
    portrait_goal: mockReportPart("uz", "portrait_goal", pathType),
    main_path: mockReportPart("uz", "main_path", pathType),
    finish: mockReportPart("uz", "finish", pathType),
    [part]: variant.content,
  } as Parameters<typeof mergeReportParts>[0];
  const content: ReportContent = mergeReportParts(parts);
  const presentation = presentReport({ level, createdAt: comparison.createdAt, profile: { ...profile, level } }, "uz", t);
  return (
    <>
      {notice}
      <ReportView
        id={`compare-${comparison.id}-${variant.slot}`}
        t={t.report}
        content={content}
        reportLocale="uz"
        levelName={presentation.levelName}
        sixteenType={presentation.sixteenType}
        learningStyles={presentation.learningStyles}
        date={presentation.date}
        mockBadge={mockBadge}
        languageNote={reportLanguageNote("uz", t)}
        footer={null}
        sections={PART_SECTIONS[part]}
      />
    </>
  );
}

function RatingForm({ id }: { id: string }) {
  return (
    <Card title="Ваша оценка">
      <form id="rating" action={rateComparisonAction} className="grid scroll-mt-4 gap-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-muted">
          Какой текст лучше звучит по-узбекски? Названия моделей, время и стоимость появятся после оценки.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["1", "2", "equal"] as const).map((v) => (
            <label
              key={v}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input type="radio" name="verdict" value={v} required />
              {VERDICT_LABELS[v]}
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Комментарий (необязательно)
          <textarea
            name="comment"
            rows={3}
            placeholder="Что понравилось или нет: естественность, слова, ошибки…"
            className="rounded-xl border-2 border-slate-200 p-3 text-sm font-normal"
          />
        </label>
        <button className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white">
          Сохранить оценку и показать модели
        </button>
      </form>
    </Card>
  );
}

function Reveal({ comparison }: { comparison: ComparisonRow }) {
  const verdict = comparison.verdict as CompareVerdict;
  return (
    <Card title="Результат">
      <div id="rating" data-testid="compare-reveal" className="scroll-mt-4 space-y-3">
        <p>
          Ваша оценка: <b>{VERDICT_LABELS[verdict] ?? verdict}</b>
          {comparison.comment && <span className="text-muted"> — «{comparison.comment}»</span>}
        </p>
        <DataTable
          head={["Вариант", "Модель", "Результат", "Время", "Стоимость", "Токены (вх/вых)"]}
          rows={comparison.variants.map((v) => [
            `Variant ${v.slot}`,
            <span key="m" className="font-mono text-xs font-bold">
              {v.model}
            </span>,
            v.status === "ready" ? (v.error ? "принят с предупреждением" : "принят") : "не прошёл проверки",
            `${seconds(v.durationMs)} (${v.attempt} попыт.)`,
            money(v.costUsd),
            <span key="t" className="font-mono text-xs">
              {v.inputTokens} / {v.outputTokens}
            </span>,
          ])}
        />
        {comparison.aiMode === "mock" && (
          <p className="text-xs text-muted">Тестовый режим ИИ: оба варианта — образец, настоящие модели не вызывались.</p>
        )}
      </div>
    </Card>
  );
}
