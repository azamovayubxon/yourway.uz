"use client";

import { useState } from "react";
import {
  COMPARE_KIND_LABELS,
  COMPARE_KINDS,
  COMPARE_PART_LABELS,
  COMPARE_PARTS,
  estimatePairCost,
  SUGGESTED_MODELS,
  type CompareKind,
  type ComparePart,
  type TokenGuess,
} from "@/lib/compare/logic";
import { startComparisonAction } from "./actions";

const usd = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;

// Форма запуска слепого сравнения. Стоимость пары пересчитывается сразу, пока вводятся модели
// (цены — из того же прайса, что и журнал ИИ), — у владельца небольшой бюджет на OpenAI.
export function CompareForm({
  tokenGuesses,
  mock,
}: {
  tokenGuesses: Record<"teaser" | ComparePart, TokenGuess>;
  mock: boolean;
}) {
  const [source, setSource] = useState("golden");
  const [kind, setKind] = useState<CompareKind>("teaser");
  const [part, setPart] = useState<ComparePart>("portrait_goal");
  const [model1, setModel1] = useState("claude-sonnet-5");
  const [model2, setModel2] = useState("gpt-6-sol");
  const [sending, setSending] = useState(false);

  const tokens = tokenGuesses[kind === "teaser" ? "teaser" : part];
  const estimate = estimatePairCost([model1, model2], tokens);
  const unknown = [model1, model2].filter((m, i) => m.trim() && estimate.perModel[i] === null);

  return (
    <form action={startComparisonAction} onSubmit={() => setSending(true)} className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Профиль</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="source" value="golden" checked={source === "golden"} onChange={() => setSource("golden")} />
          GOLDEN_PROFILE — есть своя цель (knows_goal)
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="source"
            value="golden_no_goal"
            checked={source === "golden_no_goal"}
            onChange={() => setSource("golden_no_goal")}
          />
          GOLDEN_PROFILE_NO_GOAL — без цели (no_goal)
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name="source" value="session" checked={source === "session"} onChange={() => setSource("session")} />
          Реальная завершённая сессия (ID)
        </label>
        {source === "session" && (
          <input
            name="sessionId"
            required
            placeholder="ID сессии, например 3f2c…-…"
            className="min-h-11 rounded-xl border-2 border-slate-200 px-3 font-mono text-sm"
          />
        )}
      </fieldset>

      <label className="grid gap-1 text-sm font-semibold">
        Что генерировать
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as CompareKind)}
          className="min-h-11 rounded-xl border-2 border-slate-200 px-3 text-sm font-normal"
        >
          {COMPARE_KINDS.map((k) => (
            <option key={k} value={k}>
              {COMPARE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      {kind !== "teaser" && (
        <label className="grid gap-1 text-sm font-semibold">
          Часть отчёта
          <select
            name="part"
            value={part}
            onChange={(e) => setPart(e.target.value as ComparePart)}
            className="min-h-11 rounded-xl border-2 border-slate-200 px-3 text-sm font-normal"
          >
            {COMPARE_PARTS.map((p) => (
              <option key={p} value={p}>
                {COMPARE_PART_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { name: "model1", label: "Модель A", value: model1, set: setModel1 },
          { name: "model2", label: "Модель B", value: model2, set: setModel2 },
        ].map((f) => (
          <label key={f.name} className="grid gap-1 text-sm font-semibold">
            {f.label}
            <input
              name={f.name}
              required
              list="compare-models"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="min-h-11 rounded-xl border-2 border-slate-200 px-3 font-mono text-sm font-normal"
            />
          </label>
        ))}
        <datalist id="compare-models">
          {SUGGESTED_MODELS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <p className="text-xs text-muted">
        Подсказки: {SUGGESTED_MODELS.join(", ")}. На экране варианты будут в случайном порядке и без названий.
      </p>

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm" data-testid="compare-estimate">
        <p className="font-semibold">Примерная стоимость пары</p>
        {estimate.total !== null ? (
          <p className="mt-1">
            Обычно около <b>{usd(estimate.total)}</b> (по одной попытке каждой модели: {usd(estimate.perModel[0]!)} +{" "}
            {usd(estimate.perModel[1]!)}); если обеим понадобится повтор — до <b>{usd(estimate.worst!)}</b>.
          </p>
        ) : (
          <p className="mt-1 text-amber-800">
            Цены модели {unknown.map((m) => `«${m}»`).join(" и ")} нет в прайсе — стоимость оценить нельзя.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Оценка по ~{tokens.input.toLocaleString("ru-RU")} токенов на входе и ~{tokens.output.toLocaleString("ru-RU")} на
          выходе (среднее по журналу ИИ, если там уже есть такие вызовы).
          {mock && " Сейчас тестовый режим ИИ: настоящие модели не вызываются, реальных расходов не будет."}
        </p>
      </div>

      <button
        type="submit"
        disabled={sending}
        className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white disabled:opacity-60"
      >
        {sending ? "Запускаем…" : "Запустить сравнение"}
      </button>
    </form>
  );
}
