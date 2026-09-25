import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/assessment/profile";
import { MOCK_TEASERS } from "./mock-teasers";
import {
  AiFatalError,
  createMockProvider,
  ZERO_USAGE,
  type AiProvider,
  type AiRequest,
  type AiResponse,
} from "./providers";
import { generateTeaser, normalizeUzTeaser, profileForLanguage, type AttemptLog } from "./teaser";
import { getUzGlossary } from "./uz-resources";

const profile = {
  language: "ru",
  path_type: "no_goal",
  level: "navigator",
  sixteen_type: { code: "INFP", nickname: "Посредник" },
  answer_quality: null,
} as unknown as Profile;

// Поставщик, отвечающий по очереди заранее заданными ответами (или ошибками). Запоминает запросы.
function scripted(responses: (AiResponse | Error)[]): AiProvider & { calls: number; requests: AiRequest[] } {
  const provider = {
    name: "test",
    calls: 0,
    requests: [] as AiRequest[],
    estimateCostUsd: () => null,
    async call(request: AiRequest) {
      provider.requests.push(request);
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

  it("делает не больше 1 повтора и передаёт ИИ прошлый ответ со списком проблем", async () => {
    const provider = scripted([{ text: "не json", finish: "complete", usage: ZERO_USAGE }, ok(MOCK_TEASERS.ru)]);
    const logs: AttemptLog[] = [];
    const result = await generateTeaser({ profile, locale: "ru", model: "m", provider, onAttempt: (l) => void logs.push(l) });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(logs.map((l) => [l.attempt, l.ok, l.error, l.problems])).toEqual([
      [1, false, "json:invalid", ["ответ не является валидным JSON"]],
      [2, true, null, []],
    ]);
    expect(logs[0].responseText).toBe("не json");
    expect(provider.requests[0].retry).toBeUndefined();
    expect(provider.requests[1].retry).toEqual({
      previousResponse: "не json",
      feedback: expect.stringContaining("- ответ не является валидным JSON"),
    });
    // Лимит времени на попытку и глубина размышлений передаются поставщику.
    expect(provider.requests[0]).toMatchObject({ effort: "low", maxTokens: 8000 });
    expect(provider.requests[0].timeoutMs).toBeLessThanOrEqual(60_000);
  });

  it("после 1 повтора сдаётся с понятной ошибкой", async () => {
    const provider = scripted([ok({}), ok({}), ok(MOCK_TEASERS.ru)]);
    const result = await generateTeaser({ profile, locale: "ru", model: "m", provider });
    expect(result).toMatchObject({ ok: false, attempts: 2 });
    expect(provider.calls).toBe(2);
  });

  it("обрезанный ответ: при повторе ИИ просят писать короче", async () => {
    const provider = scripted([{ ...ok(MOCK_TEASERS.ru), finish: "truncated" }, ok(MOCK_TEASERS.ru)]);
    expect(await generateTeaser({ profile, locale: "ru", model: "m", provider })).toMatchObject({ ok: true });
    expect(provider.requests[1].retry?.feedback).toContain("пишите короче");
  });

  it("не начинает повтор, если на него не осталось времени", async () => {
    let clock = 0;
    const slow: AiProvider = {
      name: "slow",
      estimateCostUsd: () => null,
      async call() {
        clock += 90_000; // первая попытка заняла 90 с из 100
        return ok({});
      },
    };
    const result = await generateTeaser({ profile, locale: "ru", model: "m", provider: slow, now: () => clock });
    expect(result).toMatchObject({ ok: false, attempts: 1 });
    expect(result.ok || result.error).toMatch(/no_time_for_retry/);
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

  it("узбекский ответ на «sen», с «Tu» или английским словом — повтор с перечнем того, что исправить", async () => {
    const good = MOCK_TEASERS.uz;
    for (const [bad, code] of [
      [{ ...good, portrait: "Sen amaliy odamsan va erkinlikni qadrlaysan." }, "rule:uz_sen:Sen"],
      [{ ...good, personality_type_label: "Pragmatist-Entrepreneur" }, "rule:uz_english:Pragmatist"],
      [{ ...good, portrait: good.portrait + " Tu kuchli odamsiz." }, "rule:uz_tu:Tu"],
    ] as const) {
      const provider = scripted([ok(bad), ok(good)]);
      const logs: AttemptLog[] = [];
      const result = await generateTeaser({ profile, locale: "uz", model: "m", provider, onAttempt: (l) => void logs.push(l) });
      expect(result).toMatchObject({ ok: true, attempts: 2 });
      expect(logs[0].error).toBe(code);
      expect(provider.requests[1].retry?.feedback).toContain(logs[0].problems[0]);
    }
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
