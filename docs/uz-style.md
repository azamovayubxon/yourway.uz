# Стиль узбекских текстов yourway.uz

Правила для всех узбекских текстов сервиса: интерфейс, заготовки, тизер и полный отчёт от ИИ. Принципы утверждены владельцем (сентябрь 2026).

## Принципы

1. **Не «красивый перевод».** Писать так, как современный узбекский сервис реально говорит с человеком: просто, уверенно, живым литературно-разговорным языком. Как пишет носитель из Ташкента.
2. **Без кальки с русского и без канцелярита.** Мысль строится сразу по-узбекски, а не переводится.
3. **Без тяжёлых слов, где есть естественная замена:** `kontekst`, `resurslar`, `model`, `variant` и т. п. Например, вместо «resurslaringiz» — «imkoniyatlaringiz», вместо «variant» — «yoʻl» или «tanlov».
4. **Обращение только «siz».** Никаких «sen», «seni», «senga», «-san», «-sang», «-ing» в форме на «sen» и никакого «Tu». «Siz» и «sen» в одном тексте не смешиваются.
5. **Без английских слов**, включая название типа. Общепринятые узбекские заимствования (biznes, startap, frilans, dizayn, onlayn) допустимы.
6. **Только латиница**, буквы oʻ gʻ со знаком ʻ, тутук со знаком ʼ (taʼlim, maʼno).

## Запрещённые конструкции

- «A nuqta», «B nuqta» → «hozir qayerdasiz», «qayerga bormoqchisiz»;
- «kutilmagan yoʻnalishdagi ilk qadamlar» → «hayron qoldiradigan yoʻnalishda nimadan boshlash kerak»;
- «halol oraliqlar» → «taxminiy oraliqlar»;
- «reallikka tekshirish» → «maqsad qanchalik real ekanini baholash»;
- «sizning uchun» → «siz uchun»;
- «mustaqillikka qiymatli beruvchi» → «mustaqillikni qadrlaydigan».

Машиночитаемый список запрещённых конструкций и английских слов лежит в [`uz-glossary.md`](uz-glossary.md): если ИИ их напишет, ответ отбрасывается и генерируется заново.

## Где это используется

| Что | Где |
|---|---|
| Правила для ИИ (на узбекском) | узбекский блок промпта, `docs/prilozhenie-b-prompty.md` §3а и `src/lib/ai/prompts.ts` |
| Названия типов, шкал, ценностей | [`uz-glossary.md`](uz-glossary.md) |
| Образцы стиля для ИИ | [`uz-teaser-examples.md`](uz-teaser-examples.md) |
| Все узбекские тексты интерфейса для вычитки | [`uz-texts.csv`](uz-texts.csv), инструкция — [`uz-texts-instrukciya.md`](uz-texts-instrukciya.md) |
| Автоматическая проверка ответа ИИ | `src/lib/ai/uz-style.ts` |
