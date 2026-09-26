// UZ_COPY.md §2–3 (аудит) и CLAUDE.md §10 (Р), задача UX-04: правка узбекского текста
// пунктов не должна менять то, что относится к подсчёту баллов — id, порядок, is_reverse,
// factor/facet/type/value/style. Снимок фиксирует эти поля отдельно от текста, поэтому
// правка формулировок (text_uz) снимок не трогает, а случайная правка ключа — трогает.
import { describe, expect, it } from "vitest";
import bigFiveRaw from "../../../data/tests/ipip_neo_60_short.json";
import perceptionRaw from "../../../data/tests/perception_8.json";
import riasecRaw from "../../../data/tests/riasec_30.json";
import valuesRaw from "../../../data/tests/values_12.json";

describe("ключи пунктов тестов не меняются при правке узбекского текста (снимок)", () => {
  it("Big Five: id, original_id, factor, facet, is_reverse", () => {
    expect(
      bigFiveRaw.questions.map((q) => ({
        id: q.id,
        original_id: q.original_id,
        factor: q.factor,
        facet: q.facet,
        is_reverse: q.is_reverse,
      })),
    ).toMatchSnapshot();
  });

  it("RIASEC: id, type", () => {
    expect(riasecRaw.questions.map((q) => ({ id: q.id, type: q.type }))).toMatchSnapshot();
  });

  it("Ценности: id, value", () => {
    expect(valuesRaw.questions.map((q) => ({ id: q.id, value: q.value }))).toMatchSnapshot();
  });

  it("Восприятие: id, style", () => {
    expect(perceptionRaw.questions.map((q) => ({ id: q.id, style: q.style }))).toMatchSnapshot();
  });

  it("русский текст пунктов не изменился (сверка со снимком)", () => {
    expect(bigFiveRaw.questions.map((q) => q.text_ru)).toMatchSnapshot();
    expect(riasecRaw.questions.map((q) => q.text_ru)).toMatchSnapshot();
    expect(valuesRaw.questions.map((q) => q.text_ru)).toMatchSnapshot();
    expect(perceptionRaw.questions.map((q) => q.text_ru)).toMatchSnapshot();
  });
});
