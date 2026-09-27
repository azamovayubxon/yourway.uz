// Механические проверки содержания и тона ответа ИИ (этап C1, ТЗ аудита §9–§10, UZ_COPY §9),
// вдобавок к проверке схемой (zod) и узбекскому стилю (uz-style.ts). Используются и тизером,
// и полным отчётом, для обоих языков — каждое нарушение здесь считается браком: генерация
// повторяется (в рамках уже существующего лимита повторов), причина попадает в /dev/ai-log
// и в результат кнопки «Проверить» в /admin/prompts.
//
// Что ищем:
//   forbidden — лесть и вредные формулировки без опоры на данные («редкий», «уникальный»,
//               «естественный талант», «идеально», «выше/ниже среднего», гарантии дохода/
//               трудоустройства/поступления). Список для UZ — в docs/uz-glossary.md
//               (forbidden_phrases), список для RU — здесь: он не хранится в docs/, так как
//               узбекский список уже читает и проверяет владелец через тот же файл, что и
//               глоссарий терминов, а для русского отдельного файла с формулировками нет.
//   url        — ссылки в тексте (ИИ не должен выдумывать URL на курсы/вузы).
//   type_code  — голый буквенный код типа (16-тип вроде INFP, код RIASEC вроде IAE) в тексте
//                вместо человеческого названия.
//   duplicate  — повторяющийся пункт в одном списке (после нормализации пробелов и регистра).
//   empty      — пустой или состоящий из пробелов пункт списка (схема это почти всегда уже
//                ловит через .min(1), эта проверка — подстраховка для случаев, когда элемент
//                списка сам является объектом с несколькими полями).

const RU_FORBIDDEN: { rule: string; re: RegExp }[] = [
  { rule: "flattery_rare", re: /редк(ий|ая|ое|ие)\s+(сочетани|комбинаци)/i },
  { rule: "flattery_unique", re: /уникальн/i },
  { rule: "flattery_natural_talent", re: /естественн(ый|ая|ое|ые)\s+(талант|способност)/i },
  { rule: "flattery_ideal", re: /идеальн(о|ый|ая|ое|ые)\s+(подходит|вам|для)/i },
  { rule: "flattery_exact_fit", re: /точно\s+(ваше|вам подходит|подходит)/i },
  { rule: "norm_above_below", re: /(выше|ниже)\s+средн(его|ем|яя|их)/i },
  // Правило тона 8 (сентябрь 2026, дополнение владельца): «способность» и «быстро осваиваете» —
  // только о том, что тест реально измерил; из открытости/стиля обучения нужно выводить интерес
  // и склонность, а не способность.
  { rule: "ability_claim", re: /(ваша|у вас)\s+способност/i },
  { rule: "ability_quick_learn", re: /быстро\s+осва[иеё]ва/i },
  { rule: "ability_original_thinking", re: /оригинальн(ое|ого|ому|ым|ом)\s+мышлени/i },
];

// Гарантии дохода/трудоустройства/поступления — но не корректное отрицание («не гарантирует»,
// «не является гарантией») из дисклеймера. Проверяем не соседнее слово (в «не является гарантией»
// между «не» и «гарантией» есть ещё слово), а всю часть предложения от последнего знака конца
// предложения до самого совпадения.
const GUARANTEE_WORD = /гарант[а-яёa-z]*/gi;
const NEGATION_BEFORE = /(?:^|\s)(не|без)\s/i;

function findGuaranteeIssues(text: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const match of text.matchAll(GUARANTEE_WORD)) {
    const clauseStart = Math.max(0, ...([".", "!", "?", ";"].map((ch) => text.lastIndexOf(ch, match.index! - 1) + 1)));
    const clause = text.slice(clauseStart, match.index);
    if (NEGATION_BEFORE.test(clause)) continue;
    issues.push({ rule: "forbidden_phrase", detail: `guarantee: «${match[0]}»` });
  }
  return issues;
}

// URL: http(s)://, www., или домен + известная зона. Специально без учёта регистра.
const URL_RE = /https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(com|net|org|uz|ru|io|edu)\b\S*/i;

// 16 типов (буквенные коды MBTI-подобной типологии) — не должны появляться в обычном тексте:
// человеку показывают только человекочитаемое название типа.
const SIXTEEN_TYPE_CODE = /\b(I[SN][TF][JP]|E[SN][TF][JP])\b/;
// RIASEC: три буквы из набора R, I, A, S, E, C подряд (код профиля интересов), например «IAE».
const RIASEC_CODE = /\b[RIASEC]{3}\b/;

export type ContentIssueRule =
  | "forbidden_phrase"
  | "url"
  | "type_code"
  | "duplicate_item"
  | "empty_item";

export interface ContentIssue {
  rule: ContentIssueRule;
  detail: string;
}

// Проверка запрещённых слов и выражений на русском (тизер и оба отчёта, RU).
export function findRuForbiddenPhrases(text: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const { rule, re } of RU_FORBIDDEN) {
    const match = text.match(re);
    if (match) issues.push({ rule: "forbidden_phrase", detail: `${rule}: «${match[0]}»` });
  }
  issues.push(...findGuaranteeIssues(text));
  return issues;
}

// Ссылки в тексте (правило ТЗ аудита §9: ИИ не подставляет URL на курсы/вузы/цены).
export function findUrls(text: string): ContentIssue[] {
  const match = text.match(URL_RE);
  return match ? [{ rule: "url", detail: match[0] }] : [];
}

// Голый код типа вместо человеческого названия (решение по тону, сентябрь 2026).
export function findBareTypeCodes(text: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const sixteen = text.match(SIXTEEN_TYPE_CODE);
  if (sixteen) issues.push({ rule: "type_code", detail: sixteen[0] });
  const riasec = text.match(RIASEC_CODE);
  if (riasec) issues.push({ rule: "type_code", detail: riasec[0] });
  return issues;
}

// Повторяющиеся или пустые пункты одного списка (top_strengths, act_now, plan_30_days и т. п.).
// label — имя поля для сообщения об ошибке.
export function findListIssues(label: string, items: readonly string[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = item.trim().toLocaleLowerCase("ru").replace(/\s+/g, " ");
    if (!normalized) {
      issues.push({ rule: "empty_item", detail: label });
      continue;
    }
    if (seen.has(normalized)) {
      issues.push({ rule: "duplicate_item", detail: `${label}: «${item.trim()}»` });
    }
    seen.add(normalized);
  }
  return issues;
}

// Все проверки контента разом для куска видимого пользователю текста (не списки — списки
// проверяются отдельно через findListIssues, у них своя семантика «дубликат»).
export function findContentIssues(text: string, language: "ru" | "uz"): ContentIssue[] {
  const issues = [...findUrls(text), ...findBareTypeCodes(text)];
  // Запрещённые фразы на русском проверяем всегда: они пишутся по-русски в системном промпте,
  // но текст сравнения — то, что реально прислала модель, а не язык вывода. На узбекском такие
  // формулировки по-русски появиться не должны, поэтому и там имеет смысл смотреть их же —
  // это ловит смешение языков заодно.
  if (language === "ru") issues.push(...findRuForbiddenPhrases(text));
  return issues;
}

export const CONTENT_ISSUE_TEXT: Record<ContentIssueRule, (detail: string) => string> = {
  forbidden_phrase: (d) => `запрещённая формулировка (лесть/гарантия/сравнение без норм): ${d}`,
  url: (d) => `в тексте есть ссылка — ИИ не должен выдумывать URL: «${d}»`,
  type_code: (d) => `голый код типа в тексте вместо названия: «${d}»`,
  duplicate_item: (d) => `повторяющийся пункт списка ${d}`,
  empty_item: (d) => `пустой пункт списка: ${d}`,
};
