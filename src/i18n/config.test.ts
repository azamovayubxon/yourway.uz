import { describe, expect, it } from "vitest";
import { resolveReportLocale } from "./config";

// Язык полного отчёта (аудит UX-06): выбирается на checkout и хранится в заказе,
// а не автоматически берётся из языка интерфейса (CLAUDE.md §7).
describe("resolveReportLocale — язык отчёта из заказа, а не из интерфейса", () => {
  it("берёт язык из формы checkout, даже если он не совпадает с языком интерфейса", () => {
    expect(resolveReportLocale("uz", "ru")).toBe("uz");
    expect(resolveReportLocale("ru", "uz")).toBe("ru");
  });

  it("совпадающий с интерфейсом выбор тоже уважается (не привязка к интерфейсу, а совпадение)", () => {
    expect(resolveReportLocale("ru", "ru")).toBe("ru");
  });

  it("откатывается на язык интерфейса, если поле формы отсутствует (как до этого решения)", () => {
    expect(resolveReportLocale(null, "uz")).toBe("uz");
    expect(resolveReportLocale(undefined, "ru")).toBe("ru");
    expect(resolveReportLocale("", "ru")).toBe("ru");
  });

  it("откатывается на язык интерфейса при повреждённом/чужом значении поля", () => {
    expect(resolveReportLocale("en", "uz")).toBe("uz");
    expect(resolveReportLocale(42, "ru")).toBe("ru");
  });
});
