import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { listModelOverrides, type ModelOverrideRow } from "@/lib/admin/models";
import { activePromptErrors, isDriftedFromCode, PROMPT_KEYS, PROMPT_LABELS, pickActiveVersion } from "@/lib/ai/prompt-registry";
import { listPromptVersions } from "@/lib/ai/prompt-store";
import { AdminShell, Card, Notice } from "../ui";
import { saveModelOverrideAction, syncPromptFromCodeAction } from "../actions";
import { PromptEditor, PromptHistory, type PromptVersionSummary } from "./PromptEditor";

export const metadata: Metadata = { robots: { index: false } };

const LABELS: Record<ModelOverrideRow["key"], string> = {
  teaser_ru: "Тизер · русский язык",
  teaser_uz: "Тизер · узбекский язык",
  report_route: "Полный отчёт · «Маршрут»",
  report_navigator: "Полный отчёт · «Навигатор»",
  report_route_uz: "Полный отчёт · «Маршрут» · только узбекский",
  report_navigator_uz: "Полный отчёт · «Навигатор» · только узбекский",
};

const SAVE_ERRORS: Record<string, string> = {
  openai_key:
    "Не сохранено: это модель OpenAI, а в окружении сайта нет ключа OPENAI_API_KEY. Сначала добавьте ключ " +
    "(Vercel → Settings → Environment Variables) и передеплойте сайт, потом выберите модель.",
  bad_name: "Не сохранено: в названии модели допустимы только латинские буквы, цифры, точка, дефис, двоеточие и «_».",
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
      {params.error && (
        <Notice kind="error">{SAVE_ERRORS[params.error] ?? "Не получилось сохранить — попробуйте ещё раз."}</Notice>
      )}

      <Card title="Модель ИИ по уровню и языку">
        <p className="text-sm text-muted">
          По умолчанию модель берётся из переменных окружения (MODEL_TEASER, MODEL_TEASER_UZ,
          MODEL_ROUTE, MODEL_NAVIGATOR). Здесь можно временно подставить другую модель без деплоя —
          пустое поле возвращает значение по умолчанию.
        </p>
        <p className="mt-2 text-sm text-muted">
          Два поставщика ИИ: модели <span className="font-mono">claude-*</span> — Anthropic,{" "}
          <span className="font-mono">gpt-*</span> и <span className="font-mono">o*</span> — OpenAI (нужен ключ
          OPENAI_API_KEY). Поля «только узбекский» задают модель отчёта на узбекском; пустое поле — как раньше,
          модель уровня. Если модель OpenAI не справилась, генерация автоматически повторяется на Claude
          (страховка) — это видно в «Себестоимости ИИ». Какая модель лучше пишет — можно выбрать вслепую
          на странице <a href="/admin/compare" className="font-semibold text-brand-600">«Сравнение моделей»</a>{" "}
          (только superadmin).
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
            // Расхождение с кодом — сравниваем ТЕКУЩУЮ активную версию с текстом в коде, а не только
            // версию 1. Раньше баннер показывался только пока активна версия 1: как только кто-то
            // хоть раз сохранял свою версию (даже давно, на этапе 4б для узбекского стиля), баннер
            // переставал появляться навсегда — и правки кода после этого молча переставали доходить
            // до боевого сайта без единого предупреждения (реальный случай: teaser_uz отстал от
            // teaser_ru на два этапа, потому что когда-то была сохранена версия 2). Теперь сравниваем
            // с активной версией всегда, независимо от её номера (isDriftedFromCode, prompt-registry.ts).
            const driftedFromCode = isDriftedFromCode(key, active);
            // Активная версия не проходит те же проверки, что при сохранении (например, в схеме нет
            // обязательного поля trial_task/free_step) — генерация с ней будет падать прямо сейчас.
            // Это отдельный, более срочный сигнал: расхождение с кодом само по себе не обязательно
            // ошибка (текст могли осознанно подправить), а вот проваленная проверка — всегда ошибка.
            const activeErrors = activePromptErrors(key, active);
            return (
              <details key={key} className="rounded-2xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-bold">
                  {PROMPT_LABELS[key]} — активна версия {active.version}
                </summary>
                <div className="mt-3 space-y-4">
                  {activeErrors.length > 0 && (
                    <div className="space-y-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      <p className="font-bold">
                        Активная версия не проходит проверку — генерация с ней сейчас не сработает:
                      </p>
                      <ul className="list-inside list-disc">
                        {activeErrors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                      {isSuperAdmin && (
                        <form action={syncPromptFromCodeAction}>
                          <input type="hidden" name="key" value={key} />
                          <button type="submit" className="min-h-9 shrink-0 rounded-lg border-2 border-rose-300 bg-white px-3 text-xs font-bold text-rose-900">
                            Создать версию из текста в коде
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                  {driftedFromCode && activeErrors.length === 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <span>
                        Текст в <code className="font-mono">src/lib/ai/prompts.ts</code> отличается от активной версии
                        (номер {active.version}) — правки в коде сейчас ни на что не влияют, сайт использует
                        активную версию из базы. Если активная версия — чья-то осознанная правка текста, сохранять
                        версию из кода не обязательно.
                      </span>
                      {isSuperAdmin && (
                        <form action={syncPromptFromCodeAction}>
                          <input type="hidden" name="key" value={key} />
                          <button type="submit" className="min-h-9 shrink-0 rounded-lg border-2 border-amber-300 bg-white px-3 text-xs font-bold text-amber-900">
                            Создать версию из текста в коде
                          </button>
                        </form>
                      )}
                    </div>
                  )}
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
