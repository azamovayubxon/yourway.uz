import { describe, expect, it } from "vitest";
import { MOCK_TEASERS } from "@/lib/ai/mock-teasers";
import { ru } from "@/i18n/dictionaries/ru";
import { uz } from "@/i18n/dictionaries/uz";
import { buildLockedToc } from "./toc";

describe("заблокированное оглавление (решение (Г))", () => {
  it("личные пункты от ИИ идут первыми, повторы убираются", () => {
    const toc = buildLockedToc(["А", "Б"], ["б", "В"]);
    expect(toc).toEqual([
      { text: "А", kind: "personal" },
      { text: "Б", kind: "personal" },
      { text: "В", kind: "general" },
    ]);
  });

  it("даже с 7 пунктами golden example в оглавлении 20+ пунктов на обоих языках", () => {
    for (const [dict, lang] of [
      [ru, "ru"],
      [uz, "uz"],
    ] as const) {
      for (const path of ["knows_goal", "no_goal"] as const) {
        const general = [...dict.teaser.generalToc, dict.teaser.pathToc[path]];
        expect(buildLockedToc(MOCK_TEASERS[lang].locked_toc, general).length).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
