// Подстановка значений в строку словаря: fmt("Вопрос {n} из {total}", { n: 3, total: 110 }).
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

// Сумма в сумах с разделителями тысяч (неразрывный пробел): formatSum(29000, "{n} сум") → «29 000 сум».
export function formatSum(amount: number, template: string): string {
  const n = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fmt(template, { n });
}

// Строка с числом и формой слова: fmtCount("{n} вопрос|{n} вопроса|{n} вопросов", 12) → «12 вопросов».
// Три формы через «|» — русские правила (1, 21 / 2–4, 22–24 / 5–20, 11–14); строка без «|»
// (узбекский: «{n} ta savol») подставляется как есть. Остальные {…} — из vars, как в fmt.
export function fmtCount(template: string, n: number, vars: Record<string, string | number> = {}): string {
  const forms = template.split("|");
  let form = forms[0]!;
  if (forms.length === 3) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) form = forms[0]!;
    else if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) form = forms[1]!;
    else form = forms[2]!;
  }
  return fmt(form, { ...vars, n });
}

// Примерная длительность части теста в минутах: около 11 секунд на вопрос, не меньше 1 минуты.
export function estimateMinutes(questions: number): number {
  return Math.max(1, Math.round((questions * 11) / 60));
}
