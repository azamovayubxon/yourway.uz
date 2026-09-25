// Ответы-образцы для тестового режима ИИ (AI_MODE=mock или нет ANTHROPIC_API_KEY),
// их отдаёт поставщик providers/mock.ts.
//
// RU — golden example тизера из Приложения Б §9, дословно (обращение на «вы»).
// UZ — тот же пример, написанный заново по-узбекски в стиле эталонов носителя (docs/uz-style.md):
// обращение на «siz», без английских слов и калек (решение (Н) в CLAUDE.md, этап 4б).
// ⚠️ ТЕКСТ ДЛЯ ВЫЧИТКИ НОСИТЕЛЕМ (строки mock.* в docs/uz-texts.csv). Используется только в тестовом режиме.

import type { TeaserContent, TeaserLanguage } from "./teaser-schema";

export const MOCK_TEASERS: Record<TeaserLanguage, TeaserContent> = {
  ru: {
    personality_type_label: "Исследователь-Творец",
    portrait:
      "Вы сочетаете редкое любопытство с тягой к самовыражению: вам важно понимать, как всё устроено, и делать это по-своему. Вы цените свободу выше стабильности — вам тесно в жёстких рамках.",
    top_strengths: ["Быстро схватываете новое", "Мыслите нестандартно", "Учитесь через практику"],
    fitting_directions: [
      { title: "Продуктовый/UX-дизайн", one_liner: "ваша связка творчества и анализа здесь работает напрямую" },
      { title: "Разработка и no-code", one_liner: "любознательность + практика = быстрый рост" },
    ],
    surprise_hook:
      "По вашему профилю есть одно направление, о котором вы, скорее всего, не думали — а именно там ваша тяга к свободе может превратиться в самый большой доход. 🔒",
    surprise_direction_internal: "продуктовое предпринимательство / микро-SaaS",
    locked_toc: [
      "Ваш полный психологический портрет",
      "3 маршрута к цели $2000+",
      "Сколько это стоит и сколько займёт",
      "Что учить в первые 90 дней",
      "Как получить первый заказ без опыта",
      "Неожиданное направление и почему оно ваше",
      "Что делать уже на этой неделе",
    ],
  },
  // ТЕКСТ ДЛЯ ВЫЧИТКИ НОСИТЕЛЕМ.
  uz: {
    personality_type_label: "Izlanuvchan ijodkor",
    portrait:
      "Siz har narsaning qanday ishlashini tushunishni va keyin uni oʻzingizcha qilishni yaxshi koʻrasiz. Qiziquvchanligingiz va oʻzingizni ifoda etish istagingiz bir-birini toʻldiradi. Erkinlik siz uchun barqarorlikdan muhimroq: qatʼiy qoidalar ichida oʻzingizni siqilgandek his qilasiz.",
    top_strengths: [
      "Yangi narsani tez ilgʻab olasiz",
      "Odatdagidan boshqacha fikrlaysiz",
      "Qilib koʻrib, amalda oʻrganasiz",
    ],
    fitting_directions: [
      {
        title: "Mahsulot va interfeys dizayni",
        one_liner: "ijodkorligingiz va tahliliy fikringiz bu yerda birga ishlaydi",
      },
      {
        title: "Dasturlash va kod yozmasdan ilova yaratish",
        one_liner: "qiziquvchanlik va amaliyot tez oʻsishga olib keladi",
      },
    ],
    surprise_hook:
      "Natijalaringizda yana bir yoʻnalish koʻrindi — ehtimol, uni hali oʻylab koʻrmagansiz. Aynan oʻsha yerda erkinlikka intilishingiz eng katta daromadga aylanishi mumkin. 🔒",
    surprise_direction_internal: "oʻz raqamli mahsulotini yaratish va sotish",
    locked_toc: [
      "Toʻliq psixologik portretingiz",
      "Oyiga $2000 dan ortiq daromadga olib boradigan 3 ta yoʻl",
      "Bu qancha turadi va qancha vaqt oladi",
      "Dastlabki 90 kunda nimani oʻrganish kerak",
      "Tajribasiz birinchi buyurtmani qanday olish mumkin",
      "Sizni hayron qoldiradigan yoʻnalish va nega aynan u sizga mos",
      "Shu haftaning oʻzida nimadan boshlash kerak",
    ],
  },
};
