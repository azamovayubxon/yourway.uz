// Проверка узбекского текста от ИИ (этап 4б). Если в ответе есть хоть одна проблема,
// ответ считается неудачным и генерация повторяется (как при любой другой ошибке проверки).
//
// Что ищем:
//   cyrillic — хоть одна кириллическая буква (узбекский у нас только латиницей);
//   tu       — слово «Tu» (встречалось в живых тизерах вместо «Siz»);
//   sen      — обращение на «sen» вместо «siz» (решение в CLAUDE.md §10);
//   english  — английское слово из стоп-списка;
//   phrase   — запрещённая конструкция («A nuqta», «halol oraliqlar» и т. п.).
// Стоп-список и запрещённые конструкции владелец правит в docs/uz-glossary.md.
//
// Поиск форм на «sen» — эвристика: узбекские окончания «sen» и «siz» иногда совпадают
// (например, «qiling» — вежливая форма, а «profiling» — форма на «sen»). Поэтому ловим только
// однозначные случаи: местоимения, «oʻzing…», глаголы на -san / -sang / -ding / -gin,
// притяжательные -laring и -ing + падеж (maqsadingni, profilingga). Этого достаточно,
// чтобы поймать смешение «sen» и «siz», которое было в живых тизерах.

export type UzIssueRule = "cyrillic" | "tu" | "sen" | "english" | "phrase";

export interface UzIssue {
  rule: UzIssueRule;
  word: string;
}

// Все виды апострофов приводим к одному, чтобы сравнивать слова независимо от того,
// каким знаком ИИ написал oʻ, gʻ и тутук.
const APOSTROPHES = /[ʻʼ'‘’`]/g;
const WORD = /[\p{L}ʻʼ'‘’`]+/gu;

const SEN_WORDS = new Set([
  "sen",
  "seni",
  "senga",
  "sening",
  "senda",
  "sendan",
  "seniki",
  "senday",
  "sendek",
  "o'zing",
  "o'zingni",
  "o'zingga",
  "o'zingda",
  "o'zingdan",
  "o'zingning",
  "o'zingcha",
]);

const SEN_PATTERNS: RegExp[] = [
  // Глаголы 2-го лица ед. числа: bilasan, qilyapsan, boʻlgansan, bilasanmi, istasang, qilding.
  /^\p{L}{2,}(san|sanmi|sang|ding|dingmi)$/u,
  // Повелительное на «sen»: qilgin, bergin.
  /^\p{L}{2,}gin$/u,
  // Притяжательное «твои …»: kuchli tomonlaring, qobiliyatlaring.
  /^\p{L}{2,}laring$/u,
  // Притяжательное «твой» + падеж: maqsadingni, profilingga, portretingda, yoʻlingdan.
  /^[\p{L}']{2,}ing(ni|ga|da|dan|ning|cha|gacha)$/u,
];

// Слова, которые похожи на формы «sen», но ими не являются.
const SEN_EXCEPTIONS = new Set(["hasan", "insan", "ehsan", "hozirgacha", "login", "plagin", "begin"]);

function isSenForm(word: string): boolean {
  if (SEN_EXCEPTIONS.has(word)) return false;
  if (SEN_WORDS.has(word)) return true;
  return SEN_PATTERNS.some((re) => re.test(word));
}

function normalizeWord(word: string): string {
  return word.toLocaleLowerCase("en").replace(APOSTROPHES, "'");
}

function normalizeText(text: string): string {
  return text.toLocaleLowerCase("en").replace(APOSTROPHES, "'").replace(/\s+/g, " ");
}

export interface UzRules {
  // Английские слова, которых не должно быть в тексте.
  stopWords: readonly string[];
  // Запрещённые конструкции. Ищутся с начала слова: «A nuqta» ловит и «A nuqtadan».
  forbiddenPhrases: readonly string[];
}

// Находит все проблемы в узбекском тексте.
export function findUzIssues(text: string, rules: Partial<UzRules> = {}): UzIssue[] {
  const { stopWords = [], forbiddenPhrases = [] } = rules;
  const issues: UzIssue[] = [];
  const cyr = text.match(/\p{Script=Cyrillic}+/u);
  if (cyr) issues.push({ rule: "cyrillic", word: cyr[0] });

  const normalized = normalizeText(text);
  for (const phrase of forbiddenPhrases) {
    const needle = normalizeText(phrase).trim();
    if (!needle) continue;
    let from = 0;
    for (let at = normalized.indexOf(needle); at !== -1; at = normalized.indexOf(needle, from)) {
      from = at + 1;
      if (at === 0 || !/[\p{L}']/u.test(normalized[at - 1])) {
        issues.push({ rule: "phrase", word: phrase });
        break;
      }
    }
  }

  const stop = new Set(stopWords.map(normalizeWord));
  for (const raw of text.match(WORD) ?? []) {
    const word = normalizeWord(raw).replace(/^'+|'+$/g, "");
    if (!word) continue;
    if (word === "tu") issues.push({ rule: "tu", word: raw });
    else if (stop.has(word)) issues.push({ rule: "english", word: raw });
    else if (isSenForm(word)) issues.push({ rule: "sen", word: raw });
  }
  return issues;
}
