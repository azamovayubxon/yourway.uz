import { describe, expect, it } from "vitest";
import { findBareTypeCodes, findContentIssues, findListIssues, findRuForbiddenPhrases, findUrls } from "./content-checks";

// Примеры взяты из живых ответов ИИ, которые владелец привёл как «сейчас не так» (этап C1,
// ТЗ аудита §9–§10): проверяем, что механическая проверка их действительно ловит.

describe("findRuForbiddenPhrases — лесть, гарантии и сравнение без норм (RU)", () => {
  it("ловит лесть без опоры на данные", () => {
    expect(findRuForbiddenPhrases("ваш профиль — редкое сочетание качеств")).toHaveLength(1);
    expect(findRuForbiddenPhrases("это уникальное сочетание навыков")).toHaveLength(1);
    expect(findRuForbiddenPhrases("у вас естественный талант к дизайну")).toHaveLength(1);
    expect(findRuForbiddenPhrases("эта профессия идеально подходит вам")).toHaveLength(1);
    expect(findRuForbiddenPhrases("направление точно ваше")).toHaveLength(1);
  });

  it("ловит сравнение с нормами, которых нет", () => {
    expect(findRuForbiddenPhrases("Средняя добросовестность (55%) — риск бросать проекты на середине; ответственность ниже среднего")).toHaveLength(
      1,
    );
    expect(findRuForbiddenPhrases("шансы выше среднего")).toHaveLength(1);
  });

  it("ловит гарантии дохода/трудоустройства/поступления", () => {
    expect(findRuForbiddenPhrases("эта профессия гарантирует высокий доход")).toHaveLength(1);
    expect(findRuForbiddenPhrases("поступление гарантировано при таком портфолио")).toHaveLength(1);
  });

  it("НЕ ловит корректное отрицание гарантии (дисклеймер)", () => {
    expect(findRuForbiddenPhrases("рекомендации не гарантируют трудоустройство или доход")).toHaveLength(0);
    expect(findRuForbiddenPhrases("это не является гарантией дохода")).toHaveLength(0);
  });

  it("не ловит обычные слова без запрещённых конструкций", () => {
    expect(findRuForbiddenPhrases("вы отметили интерес к практике и хорошо учитесь через неё")).toHaveLength(0);
  });
});

describe("findUrls — ссылки в тексте, которых там быть не должно", () => {
  it("ловит http(s), www и голые домены", () => {
    expect(findUrls("подробности на https://example.uz/course")).toHaveLength(1);
    expect(findUrls("смотрите www.coursera.org")).toHaveLength(1);
    expect(findUrls("сайт example.com расскажет больше")).toHaveLength(1);
  });

  it("не ловит обычный текст с точками", () => {
    expect(findUrls("уровень B1–B2, ориентировочно 6–12 месяцев")).toHaveLength(0);
  });
});

describe("findBareTypeCodes — голые коды типов вместо названия", () => {
  it("ловит код RIASEC из трёх букв", () => {
    expect(findBareTypeCodes("судя по вашей высокой открытости (88) и профилю IAE")).toHaveLength(1);
  });

  it("ловит 16-тип MBTI-подобный код", () => {
    expect(findBareTypeCodes("баланс между анализом и интуицией (INFP…)")).toHaveLength(1);
  });

  it("не ловит одиночную букву в скобках (пояснение конкретной шкалы)", () => {
    expect(findBareTypeCodes("исследовательская жилка (I) даёт вам аналитику")).toHaveLength(0);
  });

  it("не ловит обычные слова из пяти и более букв", () => {
    expect(findBareTypeCodes("сдать IELTS в этом году")).toHaveLength(0);
  });
});

describe("findListIssues — пустые и повторяющиеся пункты списка", () => {
  it("ловит точный повтор пункта", () => {
    const issues = findListIssues("act_now", ["Изучите Figma", "Сделайте один проект", "Изучите Figma"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].rule).toBe("duplicate_item");
  });

  it("ловит повтор с разным регистром и пробелами", () => {
    const issues = findListIssues("act_now", ["Изучите Figma", "  изучите figma  "]);
    expect(issues).toHaveLength(1);
  });

  it("ловит пустой пункт", () => {
    const issues = findListIssues("act_now", ["Изучите Figma", "   "]);
    expect(issues.map((i) => i.rule)).toEqual(["empty_item"]);
  });

  it("не ловит разные пункты", () => {
    expect(findListIssues("act_now", ["Изучите Figma", "Сделайте один проект"])).toHaveLength(0);
  });
});

describe("findContentIssues — смешение языков через русские запрещённые формулировки", () => {
  it("на узбекском тексте не проверяет русские запрещённые фразы (это делает findUzIssues отдельно)", () => {
    expect(findContentIssues("bu yoʻnalish sizga mos", "uz")).toHaveLength(0);
  });

  it("на русском тексте проверяет и лесть, и ссылки, и коды типов разом", () => {
    const issues = findContentIssues("это редкое сочетание, подробности на example.com, код IAE", "ru");
    expect(issues.map((i) => i.rule).sort()).toEqual(["forbidden_phrase", "type_code", "url"].sort());
  });
});
