import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import { listModelOverrides, type ModelOverrideRow } from "@/lib/admin/models";
import {
  PHILOSOPHY_BLOCK,
  REPORT_PROMPT_VERSION,
  REPORT_SYSTEM_TEMPLATE,
  REPORT_USER_TEMPLATE,
  TEASER_PROMPT_VERSION,
  TEASER_SYSTEM_TEMPLATE,
  TEASER_USER_TEMPLATE,
  UZ_RULES_TEMPLATE,
} from "@/lib/ai/prompts";
import { AdminShell, Card, Notice } from "../ui";
import { saveModelOverrideAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

const LABELS: Record<ModelOverrideRow["key"], string> = {
  teaser_ru: "Тизер · русский язык",
  teaser_uz: "Тизер · узбекский язык",
  report_route: "Полный отчёт · «Маршрут»",
  report_navigator: "Полный отчёт · «Навигатор»",
};

// Промпты и модели ИИ (этап 8). Сами тексты промптов редактируются в коде (src/lib/ai/prompts.ts) —
// автотест prompts.test.ts сверяет их с docs/prilozhenie-b-prompty.md, поэтому редактирование прямо
// из админки здесь сознательно не сделано (легко разойтись с документом и правилом про «вы»/siz).
// Модель для каждого уровня и языка — можно переопределить прямо здесь, без деплоя.
export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const overrides = await listModelOverrides();

  return (
    <AdminShell title="Промпты и модели" isSuperAdmin={admin.role === "superadmin"}>
      {params.ok && <Notice>Модель сохранена.</Notice>}
      {params.error && <Notice kind="error">Не получилось сохранить — попробуйте ещё раз.</Notice>}

      <Card title="Модель ИИ по уровню и языку">
        <p className="text-sm text-muted">
          По умолчанию модель берётся из переменных окружения (MODEL_TEASER, MODEL_TEASER_UZ,
          MODEL_ROUTE, MODEL_NAVIGATOR). Здесь можно временно подставить другую модель без деплоя —
          пустое поле возвращает значение по умолчанию.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {overrides.map((row) => (
            <form key={row.key} action={saveModelOverrideAction} className="grid gap-2 rounded-2xl border border-slate-200 p-4">
              <input type="hidden" name="key" value={row.key} />
              <p className="font-bold">{LABELS[row.key]}</p>
              <p className="text-xs text-muted">
                Сейчас используется: <span className="font-mono">{row.effective}</span>
                {row.override && " (переопределено)"}
              </p>
              <label className="grid gap-1 text-sm font-semibold">
                Модель (пусто — по умолчанию)
                <input
                  name="model"
                  defaultValue={row.override ?? ""}
                  placeholder={row.effective}
                  className="min-h-11 rounded-xl border-2 border-slate-200 px-3 font-mono text-sm"
                />
              </label>
              {row.updatedAt && (
                <p className="text-xs text-muted">
                  Изменил: {row.updatedBy ?? "—"} · {row.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              )}
              <button className="min-h-11 justify-self-start rounded-xl bg-brand-500 px-5 font-bold text-white">Сохранить</button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Тексты промптов (только просмотр)">
        <p className="text-sm text-muted">
          Промпты редактируются в коде (<code className="font-mono">src/lib/ai/prompts.ts</code>),
          вместе с документом <code className="font-mono">docs/prilozhenie-b-prompty.md</code> —
          автотест не даст им разойтись. Здесь можно посмотреть, что сейчас реально отправляется ИИ.
        </p>
        <div className="mt-4 space-y-4">
          <PromptBlock title={`Тизер — версия ${TEASER_PROMPT_VERSION}`}>
            <PromptText label="Философия (общий блок)" text={PHILOSOPHY_BLOCK} />
            <PromptText label="Системный промпт" text={TEASER_SYSTEM_TEMPLATE} />
            <PromptText label="Пользовательское сообщение" text={TEASER_USER_TEMPLATE} />
            <PromptText label="Правила узбекского языка (добавляются при language = uz)" text={UZ_RULES_TEMPLATE} />
          </PromptBlock>
          <PromptBlock title={`Полный отчёт — версия ${REPORT_PROMPT_VERSION}`}>
            <PromptText label="Системный промпт" text={REPORT_SYSTEM_TEMPLATE} />
            <PromptText label="Пользовательское сообщение" text={REPORT_USER_TEMPLATE} />
          </PromptBlock>
        </div>
      </Card>
    </AdminShell>
  );
}

function PromptBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-bold">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function PromptText({ label, text }: { label: string; text: string }) {
  return (
    <details>
      <summary className="cursor-pointer py-1 text-sm font-semibold text-brand-600">{label}</summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-mono text-xs">
        {text}
      </pre>
    </details>
  );
}
