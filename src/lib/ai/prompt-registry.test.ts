import { describe, expect, it } from "vitest";
import {
  nextVersionNumber,
  parsePromptVersionLabel,
  pickActiveVersion,
  PROMPT_DEFAULTS,
  PROMPT_KEYS,
  promptKeyForReport,
  promptKeyForTeaser,
  promptVersionLabel,
  validatePromptTemplates,
} from "./prompt-registry";

describe("ключи промптов", () => {
  it("тизер: только по языку", () => {
    expect(promptKeyForTeaser("ru")).toBe("teaser_ru");
    expect(promptKeyForTeaser("uz")).toBe("teaser_uz");
  });

  it("отчёт: по уровню и языку", () => {
    expect(promptKeyForReport("route", "ru")).toBe("report_route_ru");
    expect(promptKeyForReport("route", "uz")).toBe("report_route_uz");
    expect(promptKeyForReport("navigator", "ru")).toBe("report_navigator_ru");
    expect(promptKeyForReport("navigator", "uz")).toBe("report_navigator_uz");
  });

  it("у каждого ключа есть шаблон по умолчанию (текст из кода = версия 1)", () => {
    for (const key of PROMPT_KEYS) {
      expect(PROMPT_DEFAULTS[key].system.template.length).toBeGreaterThan(0);
      expect(PROMPT_DEFAULTS[key].user.template.length).toBeGreaterThan(0);
    }
  });
});

describe("выбор активной версии", () => {
  it("возвращает версию с active: true", () => {
    const versions = [
      { version: 1, active: false },
      { version: 2, active: true },
      { version: 3, active: false },
    ];
    expect(pickActiveVersion(versions)?.version).toBe(2);
  });

  it("null, если активной версии нет", () => {
    expect(pickActiveVersion([{ version: 1, active: false }])).toBeNull();
    expect(pickActiveVersion([])).toBeNull();
  });
});

describe("номер следующей версии", () => {
  it("на единицу больше максимального номера", () => {
    expect(nextVersionNumber([{ version: 1 }, { version: 3 }, { version: 2 }])).toBe(4);
  });

  it("версия 1, если истории ещё нет", () => {
    expect(nextVersionNumber([])).toBe(1);
  });
});

describe("метка версии в журнале", () => {
  it("туда и обратно", () => {
    const label = promptVersionLabel({ key: "teaser_ru", version: 3 });
    expect(label).toBe("teaser_ru:v3");
    expect(parsePromptVersionLabel(label)).toEqual({ version: 3 });
  });

  it("версия 0 (нет строки в БД) даёт метку code, которая не разбирается в номер", () => {
    expect(promptVersionLabel({ key: "teaser_ru", version: 0 })).toBe("code");
    expect(parsePromptVersionLabel("code")).toBeNull();
  });
});

describe("проверка обязательных подстановок (требование 4 этапа 8б)", () => {
  it("текст из кода проходит проверку для каждого ключа", () => {
    for (const key of PROMPT_KEYS) {
      const def = PROMPT_DEFAULTS[key];
      expect(validatePromptTemplates(key, def.system.template, def.user.template)).toEqual([]);
    }
  });

  it("тизер: без {{language}} в системном промпте — ошибка", () => {
    const def = PROMPT_DEFAULTS.teaser_ru;
    const broken = def.system.template.replace(/\{\{language\}\}/g, "русский");
    const errors = validatePromptTemplates("teaser_ru", broken, def.user.template);
    expect(errors.some((e) => e.includes("{{language}}"))).toBe(true);
  });

  it("тизер: без {{profile_json}} в пользовательском сообщении — ошибка", () => {
    const def = PROMPT_DEFAULTS.teaser_ru;
    const broken = def.user.template.replace(/\{\{profile_json\}\}/g, "профиль");
    const errors = validatePromptTemplates("teaser_ru", def.system.template, broken);
    expect(errors.some((e) => e.includes("{{profile_json}}"))).toBe(true);
  });

  it("неизвестная подстановка (опечатка) — ошибка, чтобы не упасть при генерации", () => {
    const def = PROMPT_DEFAULTS.teaser_ru;
    const broken = def.system.template + "\n{{langauge}}";
    const errors = validatePromptTemplates("teaser_ru", broken, def.user.template);
    expect(errors.some((e) => e.includes("{{langauge}}"))).toBe(true);
  });

  it("тизер: пропала метка философии — ошибка", () => {
    const def = PROMPT_DEFAULTS.teaser_ru;
    const broken = def.system.template.replace("[БЛОК ФИЛОСОФИИ ИЗ РАЗДЕЛА 2]", "");
    const errors = validatePromptTemplates("teaser_ru", broken, def.user.template);
    expect(errors.some((e) => e.includes("философии"))).toBe(true);
  });

  it("тизер: пропало поле схемы вывода — ошибка", () => {
    const def = PROMPT_DEFAULTS.teaser_ru;
    const broken = def.system.template.replace(/locked_toc/g, "");
    const errors = validatePromptTemplates("teaser_ru", broken, def.user.template);
    expect(errors.some((e) => e.includes("locked_toc"))).toBe(true);
  });

  it("отчёт: без {{teaser_json}} в пользовательском сообщении — ошибка", () => {
    const def = PROMPT_DEFAULTS.report_route_ru;
    const broken = def.user.template.replace(/\{\{teaser_json\}\}/g, "тизер");
    const errors = validatePromptTemplates("report_route_ru", def.system.template, broken);
    expect(errors.some((e) => e.includes("{{teaser_json}}"))).toBe(true);
  });

  it("отчёт: {{level}}/{{path_type}} в системном промпте допустимы (не только {{language}})", () => {
    const def = PROMPT_DEFAULTS.report_navigator_uz;
    const withLevel = def.system.template + "\n{{level}} {{path_type}}";
    expect(validatePromptTemplates("report_navigator_uz", withLevel, def.user.template)).toEqual([]);
  });
});
