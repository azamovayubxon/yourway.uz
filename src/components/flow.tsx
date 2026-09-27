// Общие кусочки прохождения теста и опроса (этап B1, ТЗ аудита §6): компактный прогресс,
// путь «Тест → Анкета → Результат» и статус сохранения по факту, а не декоративно.
// Используются и в TestRunner, и в SurveyRunner — чтобы вид не расходился между экранами.

export type FlowStage = "test" | "survey" | "result";

const STAGE_ORDER: FlowStage[] = ["test", "survey", "result"];

export function StageBreadcrumb({ current, labels }: { current: FlowStage; labels: Record<FlowStage, string> }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      {STAGE_ORDER.map((stage, i) => (
        <span key={stage} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="text-slate-300">
              →
            </span>
          )}
          <span className={stage === current ? "font-semibold text-brand-600" : undefined} aria-current={stage === current ? "step" : undefined}>
            {labels[stage]}
          </span>
        </span>
      ))}
    </p>
  );
}

export type SaveState = "saving" | "saved" | "offline" | "lost";

export interface SaveStatusTexts {
  saving: string;
  saved: string;
  offline: string;
  lost: string;
  reload: string;
  retry: string;
}

// Показывает ровно то состояние, которое есть на самом деле (ТЗ: «Сохраняем… / Сохранено /
// Не удалось сохранить. Повторить» — только по фактическому состоянию, не декоративно).
export function SaveStatus({ state, texts, onRetry }: { state: SaveState; texts: SaveStatusTexts; onRetry?: () => void }) {
  if (state === "lost") {
    return (
      <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        {texts.lost}{" "}
        <button type="button" onClick={() => window.location.reload()} className="focus-ring rounded font-semibold underline">
          {texts.reload}
        </button>
      </p>
    );
  }
  if (state === "offline") {
    return (
      <p role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span>{texts.offline}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="focus-ring shrink-0 rounded font-semibold underline">
            {texts.retry}
          </button>
        )}
      </p>
    );
  }
  if (state === "saving") {
    return (
      <p role="status" className="text-sm text-muted">
        {texts.saving}
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700">
      <span aria-hidden>✓</span>
      {texts.saved}
    </p>
  );
}

export interface PauseTexts {
  button: string;
  title: string;
  text: string;
  resume: string;
  backHome: string;
}

// «Пауза»: не отдельный экран, а честное объяснение прямо тут же — ответы и так сохраняются
// на сервере по мере ответа, поэтому «пауза» — это просто безопасно уйти и знать, куда вернуться.
export function PausePanel({ open, texts, onResume }: { open: boolean; texts: PauseTexts; onResume: () => void }) {
  if (!open) return null;
  return (
    <div role="status" className="rounded-2xl border border-line bg-brand-50 p-4 text-sm">
      <p className="font-bold text-ink">{texts.title}</p>
      <p className="mt-1.5 leading-relaxed text-muted">{texts.text}</p>
      <div className="mt-3 flex flex-wrap gap-4">
        <button type="button" onClick={onResume} className="focus-ring rounded font-semibold text-brand-600">
          {texts.resume}
        </button>
        <a href="/" className="focus-ring rounded font-semibold text-muted underline">
          {texts.backHome}
        </a>
      </div>
    </div>
  );
}
