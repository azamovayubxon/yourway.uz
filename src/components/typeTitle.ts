// Название типа — как можно крупнее, но так, чтобы самое длинное слово целиком помещалось
// в строку на любом телефоне (иначе браузер режет слово посередине). Слово с дефисом
// («Исследователь-Творец») может переноситься после дефиса, поэтому считаем его части отдельно.
export function titleFontSize(label: string, maxRem = 3): string {
  const longest = Math.max(
    4,
    ...label
      .split(/\s+/)
      .flatMap((w) => w.split(/(?<=-)/))
      .map((w) => w.length),
  );
  // 5rem — поля страницы и карточки; 0.72em — средняя ширина жирной буквы.
  return `min(${maxRem}rem, calc((100vw - 5rem) / ${(longest * 0.72).toFixed(2)}))`;
}

// То же для карточки типа на странице результата (этап 2б): карточка на компьютере уже экрана
// (левая колонка ≈400px), поэтому размер считается от ширины самой карточки (container query,
// единица cqw), а не от ширины окна. Родитель заголовка должен быть контейнером
// (container-type: inline-size).
export function cardTitleFontSize(label: string, maxRem = 3): string {
  const longest = Math.max(
    4,
    ...label
      .split(/\s+/)
      .flatMap((w) => w.split(/(?<=-)/))
      .map((w) => w.length),
  );
  // 0.64em — ширина буквы Commissioner 800 с запасом (реально ≈0.50 у латиницы и ≈0.59 у кириллицы).
  return `min(${maxRem}rem, calc(100cqw / ${(longest * 0.64).toFixed(2)}))`;
}
