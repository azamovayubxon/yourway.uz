"use client";

import { useActionState, useState } from "react";
import {
  activatePromptVersionAction,
  checkPromptAction,
  savePromptVersionAction,
  type CheckPromptState,
  type SavePromptState,
} from "../actions";
import type { PromptKey } from "@/lib/ai/prompt-registry";

export interface PromptVersionSummary {
  id: string;
  version: number;
  systemTemplate: string;
  userTemplate: string;
  comment: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  activatedBy: string | null;
  activatedAt: string | null;
}

const savedIdle: SavePromptState = { status: "idle" };
const checkIdle: CheckPromptState = { status: "idle" };

function fmtDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ") + " UTC";
}

// Редактор одного промпта (этап 8б): системный и пользовательский шаблон, комментарий, сохранение
// новой версии сразу активной, кнопка «Проверить» на golden-профиле. Редактирует и сохраняет только
// superadmin (canEdit=false у admin делает текстовые поля и кнопку «Сохранить» недоступными —
// требование 7, но сервер тоже проверяет роль в actions.ts, так что это не единственная защита).
export function PromptEditor({
  promptKey,
  active,
  canEdit,
}: {
  promptKey: PromptKey;
  active: PromptVersionSummary;
  canEdit: boolean;
}) {
  const [system, setSystem] = useState(active.systemTemplate);
  const [user, setUser] = useState(active.userTemplate);
  const [comment, setComment] = useState("");
  // Переключатель рядом с «Проверить»: какой golden-профиль подставить (Приложение Б §9;
  // «без цели» — тот же человек, но path_type = no_goal и без блока goal).
  const [withGoal, setWithGoal] = useState(true);
  const [saveState, saveAction, saving] = useActionState(savePromptVersionAction, savedIdle);
  const [checkState, checkAction, checking] = useActionState(checkPromptAction, checkIdle);

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Системный промпт (роль, жёсткие правила, схема вывода)
          <textarea
            name="systemTemplate"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            readOnly={!canEdit}
            rows={16}
            className={"min-h-40 rounded-xl border-2 border-slate-200 p-3 font-mono text-xs" + (canEdit ? "" : " opacity-60")}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Пользовательское сообщение
          <textarea
            name="userTemplate"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            readOnly={!canEdit}
            rows={8}
            className={"min-h-24 rounded-xl border-2 border-slate-200 p-3 font-mono text-xs" + (canEdit ? "" : " opacity-60")}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border-2 border-slate-200 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setWithGoal(true)}
            aria-pressed={withGoal}
            className={"min-h-11 px-3" + (withGoal ? " bg-slate-900 text-white" : " text-muted")}
          >
            С целью
          </button>
          <button
            type="button"
            onClick={() => setWithGoal(false)}
            aria-pressed={!withGoal}
            className={"min-h-11 px-3" + (!withGoal ? " bg-slate-900 text-white" : " text-muted")}
          >
            Без цели
          </button>
        </div>
        <form
          action={(formData) => {
            formData.set("key", promptKey);
            formData.set("systemTemplate", system);
            formData.set("userTemplate", user);
            formData.set("goal", withGoal ? "with" : "without");
            checkAction(formData);
          }}
        >
          <button
            type="submit"
            disabled={checking}
            className="min-h-11 rounded-xl border-2 border-brand-500 px-4 font-bold text-brand-600 disabled:opacity-50"
          >
            {checking ? "Проверяем…" : "Проверить"}
          </button>
        </form>

        {canEdit && (
          <form
            action={(formData) => {
              formData.set("key", promptKey);
              formData.set("systemTemplate", system);
              formData.set("userTemplate", user);
              formData.set("comment", comment);
              saveAction(formData);
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Что поменял — коротко"
              className="min-h-11 min-w-48 flex-1 rounded-xl border-2 border-slate-200 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl bg-brand-500 px-5 font-bold text-white disabled:opacity-50"
            >
              {saving ? "Сохраняем…" : "Сохранить новую версию"}
            </button>
          </form>
        )}
      </div>

      {saveState.status === "error" && (
        <ul className="list-inside list-disc rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {saveState.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {saveState.status === "ok" && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Сохранено как версия {saveState.version} и сделано активной. Обновите страницу, чтобы увидеть её в истории.
        </p>
      )}

      {checkState.status === "error" && (
        <ul className="list-inside list-disc rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {checkState.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {checkState.status === "done" && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold">
            {checkState.result.aiMode === "mock" && <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">тестовый режим ИИ</span>}
            Результат проверки:{" "}
            {checkState.result.ok ? (
              <span className="text-emerald-700">прошёл проверку схемой</span>
            ) : (
              <span className="text-rose-700">не прошёл проверку</span>
            )}
            {checkState.result.model && <span className="ml-2 font-mono text-xs text-muted">{checkState.result.model}</span>}
          </p>
          {checkState.result.problems.length > 0 && (
            <ul className="list-inside list-disc text-sm text-rose-800">
              {checkState.result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {checkState.result.content !== null && checkState.result.content !== undefined ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-xs">
              {JSON.stringify(checkState.result.content, null, 2)}
            </pre>
          ) : (
            checkState.result.responseText && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-xs">
                {checkState.result.responseText}
              </pre>
            )
          )}
        </div>
      )}
    </div>
  );
}

// История версий с кнопкой «сделать активной» (требование 2). Форма отправляет на сервер напрямую
// (без useActionState) — после отката страница просто перерисовывается со свежими данными.
export function PromptHistory({
  promptKey,
  versions,
  canRollback,
}: {
  promptKey: PromptKey;
  versions: PromptVersionSummary[];
  canRollback: boolean;
}) {
  return (
    <ul className="space-y-2 text-sm">
      {versions.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-2">
          <div>
            <span className="font-bold">Версия {v.version}</span>
            {v.active && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">активна</span>}
            <p className="text-xs text-muted">
              {v.createdBy ? `${v.createdBy} · ` : "из кода · "}
              {fmtDate(v.createdAt)}
              {v.comment && <> · {v.comment}</>}
            </p>
            {v.activatedBy && v.activatedAt && (
              <p className="text-xs text-muted">
                Сделал активной: {v.activatedBy} · {fmtDate(v.activatedAt)}
              </p>
            )}
          </div>
          {canRollback && !v.active && (
            <form action={activatePromptVersionAction}>
              <input type="hidden" name="key" value={promptKey} />
              <input type="hidden" name="versionId" value={v.id} />
              <button type="submit" className="min-h-9 rounded-lg border-2 border-slate-200 px-3 text-xs font-semibold">
                Сделать активной
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
