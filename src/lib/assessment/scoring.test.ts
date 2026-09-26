import { describe, expect, it } from "vitest";
import {
  bigFivePercent,
  computeScores,
  countAnswered,
  IncompleteAnswersError,
  learningStyle,
  levelOf,
  rankByScore,
  sixteenType,
  type Answers,
} from "./scoring";
import { SCALE_ORDER, TESTS, TOTAL_QUESTIONS, type TestQuestion } from "./tests";

// Собирает полный набор ответов: для каждого вопроса ответ = pick(вопрос, тест).
function buildAnswers(pick: (q: TestQuestion, testId: string) => number): Answers {
  const answers: Answers = {};
  for (const test of TESTS) {
    answers[test.id] = Object.fromEntries(test.questions.map((q) => [q.id, pick(q, test.id)]));
  }
  return answers;
}

describe("данные тестов", () => {
  it("110 вопросов в порядке воронки: Big Five 60, RIASEC 30, ценности 12, восприятие 8", () => {
    expect(TESTS.map((t) => [t.id, t.questions.length])).toEqual([
      ["big_five", 60],
      ["riasec", 30],
      ["values", 12],
      ["perception", 8],
    ]);
    expect(TOTAL_QUESTIONS).toBe(110);
  });

  it("Big Five: по 12 пунктов на шкалу, из них 6 обратных", () => {
    const bf = TESTS[0].questions;
    for (const scale of ["neuroticism", "extraversion", "openness", "agreeableness", "conscientiousness"]) {
      const items = bf.filter((q) => q.scale === scale);
      expect(items, scale).toHaveLength(12);
      expect(items.filter((q) => q.reverse), scale).toHaveLength(6);
    }
  });

  it("обратные пункты есть только в Big Five", () => {
    for (const test of TESTS.slice(1)) {
      expect(test.questions.some((q) => q.reverse), test.id).toBe(false);
    }
  });

  it("у каждого теста подписи шкалы 1–5 на двух языках", () => {
    for (const test of TESTS) {
      expect(test.scaleLabels.map((s) => s.value), test.id).toEqual([1, 2, 3, 4, 5]);
      for (const s of test.scaleLabels) {
        expect(s.label.ru.trim()).not.toBe("");
        expect(s.label.uz.trim()).not.toBe("");
      }
    }
  });

  it("узбекские тексты вопросов исправлены при загрузке (нет обычного апострофа)", () => {
    for (const test of TESTS) {
      for (const q of test.questions) expect(q.text.uz, `${test.id} #${q.id}`).not.toContain("'");
      for (const s of test.scaleLabels) expect(s.label.uz).not.toContain("'");
    }
    expect(TESTS[0].questions[1].text.uz).toBe("Koʻp vaziyatlarda oʻzimni xotirjam va erkin his qilaman.");
  });

  it("порядок шкал для ничьих взят из файлов", () => {
    expect(SCALE_ORDER.riasec).toEqual(["R", "I", "A", "S", "E", "C"]);
    expect(SCALE_ORDER.values).toEqual(["money", "freedom", "stability", "recognition", "helping", "creativity"]);
    expect(SCALE_ORDER.perception).toEqual(["reading", "auditory", "practice", "repetition"]);
  });
});

describe("Big Five", () => {
  it("формула процентов: 12 → 0, 36 → 50, 60 → 100", () => {
    expect(bigFivePercent(12)).toBe(0);
    expect(bigFivePercent(36)).toBe(50);
    expect(bigFivePercent(60)).toBe(100);
    expect(bigFivePercent(37)).toBe(52); // 52,08
    expect(bigFivePercent(35)).toBe(48); // 47,9
    expect(bigFivePercent(18)).toBe(13); // 12,5 → округление вверх
  });

  it("обратный пункт: балл = 6 − ответ", () => {
    // Все ответы 3 (нейтрально) → по 36 на шкалу. Меняем один обратный пункт нейротизма (№2) на 1:
    // балл за него 6 − 1 = 5 вместо 3, сумма 38.
    const answers = buildAnswers(() => 3);
    answers.big_five![2] = 1;
    const s = computeScores(answers);
    expect(s.big_five_raw.neuroticism).toBe(38);
    // А прямой пункт (№1) с ответом 1 уменьшает сумму: 3 → 1, сумма 34.
    const answers2 = buildAnswers(() => 3);
    answers2.big_five![1] = 1;
    expect(computeScores(answers2).big_five_raw.neuroticism).toBe(34);
  });

  it("крайние значения: максимум по всем шкалам = 100%", () => {
    // Прямые пункты 5, обратные 1 → каждый пункт даёт 5 баллов.
    const s = computeScores(buildAnswers((q) => (q.reverse ? 1 : 5)));
    for (const v of Object.values(s.big_five_raw)) expect(v).toBe(60);
    for (const v of Object.values(s.big_five)) expect(v).toBe(100);
    for (const v of Object.values(s.big_five_levels)) expect(v).toBe("high");
    expect(s.sixteen_type.code).toBe("ENFJ");
  });

  it("крайние значения: минимум по всем шкалам = 0%", () => {
    const s = computeScores(buildAnswers((q) => (q.reverse ? 5 : 1)));
    for (const v of Object.values(s.big_five_raw)) expect(v).toBe(12);
    for (const v of Object.values(s.big_five)) expect(v).toBe(0);
    for (const v of Object.values(s.big_five_levels)) expect(v).toBe("low");
    expect(s.sixteen_type.code).toBe("ISTP");
  });

  it("уровни по третям: 0–33 низкий, 34–66 средний, 67–100 высокий", () => {
    expect(levelOf(0)).toBe("low");
    expect(levelOf(33)).toBe("low");
    expect(levelOf(34)).toBe("medium");
    expect(levelOf(66)).toBe("medium");
    expect(levelOf(67)).toBe("high");
    expect(levelOf(100)).toBe("high");
  });
});

describe("16-тип", () => {
  const base = { neuroticism: 50, extraversion: 40, openness: 88, agreeableness: 62, conscientiousness: 55 };

  it("E40 O88 A62 C55 → INFJ (в примере mapping-файла ошибочно INFP: C = 55 > 50 даёт J)", () => {
    expect(sixteenType(base).code).toBe("INFJ");
  });

  it("E40 O88 A62 C45 → INFP (Идеалист)", () => {
    const t = sixteenType({ ...base, conscientiousness: 45 });
    expect(t.code).toBe("INFP");
    expect(t.nickname).toEqual({ ru: "Идеалист", uz: "Idealist" });
  });

  it("ровно 50 уходит в low pole (I, S, T, P), 51 — в high pole", () => {
    const at50 = { neuroticism: 50, extraversion: 50, openness: 50, agreeableness: 50, conscientiousness: 50 };
    expect(sixteenType(at50).code).toBe("ISTP");
    const at51 = { neuroticism: 50, extraversion: 51, openness: 51, agreeableness: 51, conscientiousness: 51 };
    expect(sixteenType(at51).code).toBe("ENFJ");
  });

  it("нейротизм не влияет на тип", () => {
    expect(sixteenType({ ...base, neuroticism: 0 }).code).toBe(sixteenType({ ...base, neuroticism: 100 }).code);
  });

  it("слабо выраженные оси: |pct − 50| ≤ 5", () => {
    const t = sixteenType({ neuroticism: 0, extraversion: 45, openness: 55, agreeableness: 44, conscientiousness: 56 });
    expect(t.weak_axes).toEqual(["E_I", "S_N"]);
  });

  it("названия есть для всех 16 кодов на обоих языках, узбекские — с ʻ", () => {
    const t = sixteenType({ neuroticism: 0, extraversion: 60, openness: 10, agreeableness: 10, conscientiousness: 60 });
    expect(t.code).toBe("ESTJ");
    expect(sixteenType({ neuroticism: 0, extraversion: 60, openness: 60, agreeableness: 10, conscientiousness: 60 }).nickname.uz).toBe("Qoʻmondon");
  });
});

describe("RIASEC", () => {
  it("код — топ-3 по убыванию суммы", () => {
    const pts: Record<string, number> = { R: 1, I: 5, A: 4, S: 2, E: 3, C: 1 };
    const s = computeScores(buildAnswers((q, test) => (test === "riasec" ? pts[q.scale] : 3)));
    expect(s.riasec.scores).toEqual({ R: 5, I: 25, A: 20, S: 10, E: 15, C: 5 });
    expect(s.riasec.code).toBe("IAE");
  });

  it("ничья: порядок R→I→A→S→E→C", () => {
    // Все суммы равны → RIA.
    expect(computeScores(buildAnswers(() => 5)).riasec.code).toBe("RIA");
    // C и S равны и выше остальных → S раньше C; дальше ничья R/I/A/E → R.
    const pts: Record<string, number> = { R: 2, I: 2, A: 2, S: 4, E: 2, C: 4 };
    expect(computeScores(buildAnswers((q, test) => (test === "riasec" ? pts[q.scale] : 3))).riasec.code).toBe("SCR");
  });
});

describe("ценности", () => {
  it("ранжирование по убыванию суммы, суммы передаются отдельно", () => {
    const pts: Record<string, number> = { money: 4, freedom: 5, stability: 2, recognition: 3, helping: 1, creativity: 4 };
    const s = computeScores(buildAnswers((q, test) => (test === "values" ? pts[q.scale] : 3)));
    expect(s.values_scores).toEqual({ money: 8, freedom: 10, stability: 4, recognition: 6, helping: 2, creativity: 8 });
    // money и creativity по 8: money раньше (порядок файла).
    expect(s.values_ranked).toEqual(["freedom", "money", "creativity", "recognition", "stability", "helping"]);
  });

  it("все равны → порядок файла", () => {
    expect(computeScores(buildAnswers(() => 5)).values_ranked).toEqual(SCALE_ORDER.values);
  });

  it("rankByScore не зависит от порядка ключей в объекте сумм", () => {
    expect(rankByScore({ creativity: 5, money: 5, freedom: 1 }, ["money", "freedom", "creativity"])).toEqual([
      "money",
      "creativity",
      "freedom",
    ]);
  });
});

describe("стиль восприятия", () => {
  const order = SCALE_ORDER.perception;

  it("разница с ближайшим ≥ 2 → один стиль (строка)", () => {
    expect(learningStyle({ reading: 6, auditory: 5, practice: 9, repetition: 4 }, order)).toBe("practice");
  });

  it("разница 1 → два стиля", () => {
    expect(learningStyle({ reading: 8, auditory: 5, practice: 9, repetition: 4 }, order)).toEqual(["practice", "reading"]);
  });

  it("разница 0 → два стиля в порядке файла", () => {
    expect(learningStyle({ reading: 4, auditory: 7, practice: 7, repetition: 7 }, order)).toEqual(["auditory", "practice"]);
  });

  it("все ответы 5 → reading и auditory", () => {
    const s = computeScores(buildAnswers(() => 5));
    expect(s.learning_style).toEqual(["reading", "auditory"]);
    expect(s.learning_style_scores).toEqual({ reading: 10, auditory: 10, practice: 10, repetition: 10 });
  });
});

describe("проверка ответов", () => {
  it("все ответы «5»: итог для ручной проверки", () => {
    const s = computeScores(buildAnswers(() => 5));
    // Big Five: 6 прямых × 5 + 6 обратных × (6 − 5) = 30 + 6 = 36 → 50%.
    for (const v of Object.values(s.big_five_raw)) expect(v).toBe(36);
    for (const v of Object.values(s.big_five)) expect(v).toBe(50);
    expect(s.sixteen_type.code).toBe("ISTP");
    expect(s.sixteen_type.weak_axes).toEqual(["E_I", "S_N", "T_F", "J_P"]);
    expect(s.riasec).toEqual({ code: "RIA", scores: { R: 25, I: 25, A: 25, S: 25, E: 25, C: 25 } });
  });

  it("без ответа на вопрос подсчёт не выполняется", () => {
    const answers = buildAnswers(() => 3);
    delete answers.perception![8];
    expect(() => computeScores(answers)).toThrow(IncompleteAnswersError);
    expect(countAnswered(answers)).toBe(109);
  });

  it("ответ вне 1–5 — ошибка", () => {
    const answers = buildAnswers(() => 3);
    answers.values![1] = 6;
    expect(() => computeScores(answers)).toThrow(RangeError);
    answers.values![1] = 2.5;
    expect(() => computeScores(answers)).toThrow(RangeError);
  });

  it("countAnswered считает только существующие вопросы", () => {
    expect(countAnswered(buildAnswers(() => 3))).toBe(110);
    expect(countAnswered({ big_five: { 1: 3, 999: 3 } })).toBe(1);
  });
});

describe("пример «на пальцах» (из отчёта владельцу)", () => {
  // Big Five: для каждой шкалы свой ответ на прямые и на обратные пункты.
  const bf: Record<string, [number, number]> = {
    neuroticism: [2, 4], // прямые 2, обратные 4 → 6×2 + 6×(6−4) = 24
    extraversion: [3, 3], // 6×3 + 6×3 = 36
    openness: [5, 1], // 6×5 + 6×(6−1) = 60
    agreeableness: [4, 2], // 6×4 + 6×(6−2) = 48
    conscientiousness: [4, 3], // 6×4 + 6×(6−3) = 42
  };
  const riasec: Record<string, number> = { R: 1, I: 4, A: 5, S: 3, E: 4, C: 2 };
  // Ценности и восприятие: ответ на каждый вопрос по его номеру.
  const values: Record<number, number> = { 1: 4, 2: 5, 3: 3, 4: 4, 5: 2, 6: 5, 7: 5, 8: 5, 9: 3, 10: 5, 11: 3, 12: 4 };
  const perception: Record<number, number> = { 1: 4, 2: 2, 3: 5, 4: 3, 5: 4, 6: 3, 7: 4, 8: 2 };

  const s = computeScores(
    buildAnswers((q, test) => {
      if (test === "big_five") return q.reverse ? bf[q.scale][1] : bf[q.scale][0];
      if (test === "riasec") return riasec[q.scale];
      if (test === "values") return values[q.id];
      return perception[q.id];
    }),
  );

  it("совпадает с расчётом вручную", () => {
    expect(s.big_five_raw).toEqual({ neuroticism: 24, extraversion: 36, openness: 60, agreeableness: 48, conscientiousness: 42 });
    expect(s.big_five).toEqual({ neuroticism: 25, extraversion: 50, openness: 100, agreeableness: 75, conscientiousness: 63 });
    expect(s.big_five_levels).toEqual({ neuroticism: "low", extraversion: "medium", openness: "high", agreeableness: "high", conscientiousness: "medium" });
    expect(s.sixteen_type.code).toBe("INFJ");
    expect(s.sixteen_type.nickname.ru).toBe("Вдохновитель");
    expect(s.sixteen_type.weak_axes).toEqual(["E_I"]);
    expect(s.riasec).toEqual({ code: "AIE", scores: { R: 5, I: 20, A: 25, S: 15, E: 20, C: 10 } });
    expect(s.values_scores).toEqual({ money: 9, freedom: 10, stability: 6, recognition: 9, helping: 5, creativity: 9 });
    expect(s.values_ranked).toEqual(["freedom", "money", "recognition", "creativity", "stability", "helping"]);
    expect(s.learning_style_scores).toEqual({ reading: 8, auditory: 5, practice: 9, repetition: 5 });
    expect(s.learning_style).toEqual(["practice", "reading"]);
  });
});
