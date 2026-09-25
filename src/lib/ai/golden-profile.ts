// Golden-профиль для кнопки «Проверить» в /admin/prompts (этап 8б, требование 5): тот же человек,
// что в рабочем примере Приложения Б §9, но в формате реального профиля (решение (Д) в CLAUDE.md —
// §9 в документе сокращён и с человекочитаемыми подписями "низкий" вместо кодов, это только пример
// входа, а не образец формата). Используется только для проверки черновика промпта — не сохраняется
// как отчёт пользователя.

import type { Profile } from "@/lib/assessment/profile";

export const GOLDEN_PROFILE: Profile = {
  language: "ru",
  path_type: "knows_goal",
  level: "route",
  demographics: { age: 19, gender: "m" },
  big_five: { openness: 88, conscientiousness: 55, extraversion: 40, agreeableness: 62, neuroticism: 50 },
  sixteen_type: { code: "INFP", nickname: "Посредник" },
  riasec: { code: "IAE", scores: { I: 24, A: 22, E: 18, R: 12, S: 14, C: 10 } },
  values_ranked: ["freedom", "money", "creativity", "recognition", "stability", "helping"],
  values_scores: { freedom: 10, money: 9, creativity: 8, recognition: 6, stability: 5, helping: 4 },
  learning_style: "practice",
  learning_style_scores: { practice: 9, reading: 6, auditory: 5, repetition: 4 },
  resources: {
    status: "student",
    budget_range: "low",
    hours_per_week: "10-20",
    languages: ["uz", "ru", "en"],
    english_level: "basic",
    relocation: "no",
    online_ok: "yes",
    experience_level: "some",
  },
  goal: {
    statement: "Зарабатывать удалённо на цифровых продуктах",
    desired_income: "10-20m",
    employment_type: "freelance",
    timeframe: "2-3y",
    risk: "medium",
    lifestyle: ["flexible", "remote"],
  },
  answer_quality: null,
};

// Тот же профиль для навигатора (без своей цели) — используется при проверке промптов навигатора.
export const GOLDEN_PROFILE_NO_GOAL: Profile = {
  ...GOLDEN_PROFILE,
  path_type: "no_goal",
  level: "navigator",
  goal: undefined,
};
