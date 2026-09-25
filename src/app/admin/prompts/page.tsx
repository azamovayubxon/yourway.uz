import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { listModelOverrides, type ModelOverrideRow } from "@/lib/admin/models";
import { PROMPT_KEYS, PROMPT_LABELS, pickActiveVersion } from "@/lib/ai/prompt-registry";
import { listPromptVersions } from "@/lib/ai/prompt-store";
import { AdminShell, Card, Notice } from "../ui";
import { saveModelOverrideAction } from "../actions";
import { PromptEditor, PromptHistory, type PromptVersionSummary } from "./PromptEditor";

export const metadata: Metadata = { robots: { index: false } };

const LABELS: Record<ModelOverrideRow["key"], string> = {
  teaser_ru: "Тизер · русский язык",
  teaser_uz: "Тизер · узбекский язык",
  report_route: "Полный отчёт · «Маршрут»",
  report_navigator: "Полный отчёт · «Навигатор»",
};

function toSummary(row: Awaited<ReturnType<typeof listPromptVersions>>[number]): PromptVersionSummary {
  return {
    id: row.id,
    version: row.version,
    systemTemplate: row.systemTemplate,
    userTemplate: row.userTemplate,
    comment: row.comment,
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    activatedBy: row.activatedBy,
    activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
  };
}

// Промпты и модели (этап 8, дополнено этапом 8б): версии промптов в БД, история и откат — только
// у superadmin (требование 7), admin видит тексты и результат «Проверить», но не может сохранять.
export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "superadmin";
  const params = await searchParams;
  const overrides = await listModelOverrides();
  const promptVersions = await Promise.all(PROMPT_KEYS.map((key) => listPromptVersions(key)));

  return (
    <AdminShell title="Промпты и модели" isSuperAdmin={isSuperAdmin}>
      {params.ok && <Notice>Сохранено.</Notice>}
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

      <Card title="Тексты промптов и их версии">
        <p className="text-sm text-muted">
          Редактирование сохраняет новую версию (кто, когда, комментарий «что поменял») и сразу
          делает её активной; история версий видна ниже, откат — кнопкой «сделать активной».
          {!isSuperAdmin && " Ваша роль (admin) позволяет только смотреть и проверять — сохранять и откатывать может superadmin."}
          {" "}Философия продукта, правила узбекского языка, справочник баллов и JSON-схема отчёта — общая
          инфраструктура вызовов ИИ, они не редактируются здесь и проверяются отдельным автотестом
          на соответствие документу и правилу «вы/siz».
        </p>
        <div className="mt-4 space-y-4">
          {PROMPT_KEYS.map((key, i) => {
            const versions = promptVersions[i].map(toSummary);
            const active = pickActiveVersion(versions) ?? versions[0];
            return (
              <details key={key} className="rounded-2xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-bold">
                  {PROMPT_LABELS[key]} — активна версия {active.version}
                </summary>
                <div className="mt-3 space-y-4">
                  <PromptEditor promptKey={key} active={active} canEdit={isSuperAdmin} />
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-brand-600">
                      История версий ({versions.length})
                    </summary>
                    <div className="mt-2">
                      <PromptHistory promptKey={key} versions={versions} canRollback={isSuperAdmin} />
                    </div>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      </Card>
    </AdminShell>
  );
}
