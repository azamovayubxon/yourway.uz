import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/assessment/profile";
import { MOCK_TEASERS } from "./mock-teasers";
import { AiFatalError, createMockProvider, ZERO_USAGE, type AiProvider, type AiResponse } from "./providers";
import { generateTeaser, normalizeUzTeaser, profileForLanguage, type AttemptLog } from "./teaser";
import { getUzGlossary } from "./uz-resources";

const profile = {
  language: "ru",
  path_type: "no_goal",
  level: "navigator",
  sixteen_type: { code: "INFP", nickname: "Посредник" },
  answer_quality: null,
} as unknown as Profile;

// Поставщик, отвечающий по очереди заранее заданными ответами (или ошибками).
function scripted(responses: (AiResponse | Error)[]): AiProvider & { calls: number } {
  const provider = {
    name: "test",
    calls: 0,
    estimateCostUsd: () => null,
    async call() {
      const next = responses[provider.calls++];
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return provider;
}

const ok = (content: unknown): AiResponse => ({ text: JSON.stringify(content), finish: "complete", usage: ZERO_USAGE });

describe("генерация тизера", () => {
  it("в тестовом режиме отдаёт golden example на нужном языке", async () => {
    const provider = createMockProvider(0);
    const ru = await generateTeaser({ profile, locale: "ru", model: "mock", provider });
    const uz = await generateTeaser({ profile, locale: "uz", model: "mock", provider });
    expect(ru).toMatchObject({ ok: true, attempts: 1, content: MOCK_TEASERS.ru });
    expect(uz).toMatchObject({ ok: true, attempts: 1, content: MOCK_TEASERS.uz });
  });

  it("повторяет генерацию, если ответ не прошёл проверку, и логирует каждую попытку", async () => {
    const provider = scripted([
      { text: "не json", finish: "complete", usage: ZERO_USAGE },
      { ...ok(MOCK_TEASERS.ru), finish: "truncated" },
      ok(MOCK_TEASERS.ru),
    ]);
    const logs: AttemptLog[] = [];
    const result = await generateTeaser({
      profile,
      locale: "ru",
      model: "m",
      provider,
      onAttempt: (l) => void logs.push(l),
    });
    expect(result).toMatchObject({ ok: true, attempts: 3 });
    expect(logs.map((l) => [l.attempt, l.ok, l.error])).toEqual([
      [1, false, "json:invalid"],
      [2, false, "finish:truncated"],
      [3, true, null],
    ]);
  });

  it("после 2 повторов (3 попыток) сдаётся с понятной ошибкой", async () => {
    const provider = scripted([ok({}), ok({}), ok({}), ok(MOCK_TEASERS.ru)]);
    const result = await generateTeaser({ profile, locale: "ru", model: "m", provider });
    expect(result).toMatchObject({ ok: false, attempts: 3 });
    expect(provider.calls).toBe(3);
  });

  it("не повторяет запрос при неисправимой ошибке (например, неверный ключ)", async () => {
    const provider = scripted([new AiFatalError("bad key"), ok(MOCK_TEASERS.ru)]);
    const result = await generateTeaser({ profile, locale: "ru", model: "m", provider });
    expect(result).toMatchObject({ ok: false, attempts: 1 });
    expect(provider.calls).toBe(1);
  });

  it("повторяет запрос при сетевой ошибке", async () => {
    const provider = scripted([new Error("ECONNRESET"), ok(MOCK_TEASERS.ru)]);
    expect(await generateTeaser({ profile, locale: "ru", model: "m", provider })).toMatchObject({
      ok: true,
      attempts: 2,
    });
  });

  it("исправляет апострофы в узбекском ответе ИИ (решение (Б))", () => {
    expect(normalizeUzTeaser({ a: ["o'zbek ta'lim", "g‘oya", "ko’p"] })).toEqual({
      a: ["oʻzbek taʼlim", "gʻoya", "koʻp"],
    });
  });

  it("профиль для ИИ получает язык генерации и название 16-типа на этом языке", () => {
    const uz = profileForLanguage(profile, "uz");
    expect(uz.language).toBe("uz");
    expect(uz.sixteen_type.code).toBe("INFP");
    expect(uz.sixteen_type.nickname).not.toBe("Посредник");
    expect(profile.language).toBe("ru");
  });

  it("узбекское название 16-типа для ИИ берётся из глоссария", () => {
    const row = getUzGlossary().tables.sixteen_types.find((r) => r.code === "INFP")!;
    expect(profileForLanguage(profile, "uz").sixteen_type.nickname).toBe(row.uz);
  });

  it("узбекский ответ на «sen», с «Tu», кириллицей или английским словом — повторная генерация", async () => {
    const good = MOCK_TEASERS.uz;
    const provider = scripted([
      ok({ ...good, portrait: "Sen amaliy odamsan va erkinlikni qadrlaysan." }),
      ok({ ...good, personality_type_label: "Pragmatist-Entrepreneur" }),
      ok({ ...good, portrait: good.portrait + " Tu kuchli odamsiz." }),
      ok(good),
    ]);
    const logs: AttemptLog[] = [];
    const result = await generateTeaser({ profile, locale: "uz", model: "m", provider, onAttempt: (l) => void logs.push(l) });
    // 3 попытки (1 + 2 повтора): все три отбракованы проверкой узбекского.
    expect(result).toMatchObject({ ok: false, attempts: 3 });
    expect(logs.map((l) => l.error)).toEqual(["rule:uz_sen:Sen", "rule:uz_english:Entrepreneur", "rule:uz_tu:Tu"]);

    const retry = scripted([ok({ ...good, top_strengths: ["Kuchli tomonlaring", "Tez oʻrganasiz"] }), ok(good)]);
    expect(await generateTeaser({ profile, locale: "uz", model: "m", provider: retry })).toMatchObject({
      ok: true,
      attempts: 2,
    });
  });

  it("в узбекский промпт попадают правила на узбекском, глоссарий и эталоны", async () => {
    let system = "";
    const spy: AiProvider = {
      name: "spy",
      estimateCostUsd: () => null,
      async call(request) {
        system = request.system;
        return ok(MOCK_TEASERS.uz);
      },
    };
    await generateTeaser({ profile, locale: "uz", model: "m", provider: spy });
    expect(system).toContain("OʻZBEK TILIDA YOZISH QOIDALARI");
    expect(system).toContain("USLUB NAMUNALARI");
    await generateTeaser({ profile, locale: "ru", model: "m", provider: spy });
    expect(system).not.toContain("OʻZBEK TILIDA YOZISH QOIDALARI");
  });
});
