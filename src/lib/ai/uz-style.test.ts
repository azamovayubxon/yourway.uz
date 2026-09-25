import { describe, expect, it } from "vitest";
import { findUzIssues } from "./uz-style";

const rules = { stopWords: ["business", "startup", "vs"], forbiddenPhrases: ["A nuqta", "halol oraliq"] };
const rulesOf = (text: string) => findUzIssues(text, rules).map((i) => `${i.rule}:${i.word}`);

describe("проверка узбекского текста", () => {
  it("чистый текст на «siz» проходит", () => {
    const text =
      "Siz amaliy fikrlaydigan, mustaqil qaror qilishni yaxshi koʻradigan odamsiz. Maqsadingizni oʻz soʻzlaringiz bilan yozing, bu sizga qoʻl keladi. Testlarni qaytadan topshiring.";
    expect(findUzIssues(text, rules)).toEqual([]);
  });

  it("ловит кириллицу", () => {
    expect(rulesOf("Siz tahlilchi — аналитик")).toEqual(["cyrillic:аналитик"]);
  });

  it("ловит «Tu» как отдельное слово, но не внутри слов", () => {
    expect(rulesOf("Tu kuchli odamsiz")).toEqual(["tu:Tu"]);
    expect(rulesOf("Tuzilgan reja, tushunarli yoʻl")).toEqual([]);
  });

  it("ловит формы на «sen»", () => {
    expect(rulesOf("Sen kuchlisan")).toEqual(["sen:Sen", "sen:kuchlisan"]);
    expect(rulesOf("senga, sening, seni")).toEqual(["sen:senga", "sen:sening", "sen:seni"]);
    expect(rulesOf("bilasanmi? istasang qilding")).toEqual(["sen:bilasanmi", "sen:istasang", "sen:qilding"]);
    expect(rulesOf("kuchli tomonlaring")).toEqual(["sen:tomonlaring"]);
    expect(rulesOf("maqsadingni profilingga portretingda")).toEqual([
      "sen:maqsadingni",
      "sen:profilingga",
      "sen:portretingda",
    ]);
    expect(rulesOf("oʻzingni o'zingga")).toEqual(["sen:oʻzingni", "sen:o'zingga"]);
  });

  it("не путает «siz»-формы и обычные слова с формами на «sen»", () => {
    const text =
      "maqsadingizni kuchli tomonlaringiz qiling oʻqing oʻzingiz oʻzingizni keyingi yangi mingga tongda dengizga Hasan";
    expect(findUzIssues(text, rules)).toEqual([]);
  });

  it("ловит формы на «sen» и в словах с апострофом", () => {
    expect(rulesOf("Siz boʻlasan emas, boʻlasiz")).toEqual(["sen:boʻlasan"]);
    expect(rulesOf("yoʻlingni topding")).toEqual(["sen:yoʻlingni", "sen:topding"]);
  });

  it("не считает формами на «sen» наречия на -san и заимствования на -ing (ложные срабатывания)", () => {
    const text =
      "Asosan, shaxsan va xususan siz marketingda, treningga, konsaltingda, reytingdan, xoldingda va brendingda ishlay olasiz.";
    expect(findUzIssues(text, rules)).toEqual([]);
  });

  it("ловит английские слова из стоп-списка в любом регистре", () => {
    expect(rulesOf("Startup vs. established Business")).toEqual(["english:Startup", "english:vs", "english:Business"]);
    // Узбекские заимствования — не английские слова.
    expect(rulesOf("biznes startap frilans")).toEqual([]);
  });

  it("ловит запрещённые конструкции с начала слова и с любым апострофом", () => {
    expect(rulesOf("A nuqtadan B nuqtagacha")).toEqual(["phrase:A nuqta"]);
    expect(rulesOf("Muddat va pul: halol oraliqlar")).toEqual(["phrase:halol oraliq"]);
    expect(rulesOf("Katta nuqtalar")).toEqual([]);
    expect(
      findUzIssues("Kutilmagan yo‘nalishdagi ilk qadamlar", { forbiddenPhrases: ["kutilmagan yoʻnalishdagi"] }),
    ).toHaveLength(1);
  });
});
