// Подстановка значений в строку словаря: fmt("Вопрос {n} из {total}", { n: 3, total: 110 }).
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
