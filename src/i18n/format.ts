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
