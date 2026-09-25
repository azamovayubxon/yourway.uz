// Ответы-образцы для тестового режима ИИ (AI_MODE=mock или нет ANTHROPIC_API_KEY),
// их отдаёт поставщик providers/mock.ts.
//
// RU — golden example тизера из Приложения Б §9, дословно.
// UZ — перевод того же примера на узбекский (решение (Н) в CLAUDE.md).
// ⚠️ ПЕРЕВОД ДЛЯ ВЫЧИТКИ НОСИТЕЛЕМ. Используется только в тестовом режиме.

import type { TeaserContent, TeaserLanguage } from "./teaser-schema";

export const MOCK_TEASERS: Record<TeaserLanguage, TeaserContent> = {
  ru: {
    personality_type_label: "Исследователь-Творец",
    portrait:
      "Ты сочетаешь редкое любопытство с тягой к самовыражению: тебе важно понимать, как всё устроено, и делать это по-своему. Ты ценишь свободу выше стабильности — тебе тесно в жёстких рамках.",
    top_strengths: ["Быстро схватываешь новое", "Мыслишь нестандартно", "Учишься через практику"],
    fitting_directions: [
      { title: "Продуктовый/UX-дизайн", one_liner: "твоя связка творчества и анализа здесь работает напрямую" },
      { title: "Разработка и no-code", one_liner: "любознательность + практика = быстрый рост" },
    ],
    surprise_hook:
      "По твоему профилю есть одно направление, о котором ты, скорее всего, не думал — а именно там твоя тяга к свободе может превратиться в самый большой доход. 🔒",
    surprise_direction_internal: "продуктовое предпринимательство / микро-SaaS",
    locked_toc: [
      "Твой полный психологический портрет",
      "3 маршрута к цели $2000+",
      "Сколько это стоит и сколько займёт",
      "Что учить в первые 90 дней",
      "Как получить первый заказ без опыта",
      "Неожиданное направление и почему оно твоё",
      "Что делать уже на этой неделе",
    ],
  },
  // ПЕРЕВОД ДЛЯ ВЫЧИТКИ НОСИТЕЛЕМ.
  uz: {
    personality_type_label: "Tadqiqotchi-Ijodkor",
    portrait:
      "Sen noyob qiziquvchanlikni oʻzingni ifoda etishga boʻlgan intilish bilan uygʻunlashtirasan: senga hamma narsa qanday tuzilganini tushunish va buni oʻzingcha qilish muhim. Sen erkinlikni barqarorlikdan ustun qoʻyasan — qatʼiy qoliplarda senga tor.",
    top_strengths: ["Yangi narsalarni tez ilgʻab olasan", "Nostandart fikrlaysan", "Amaliyot orqali oʻrganasan"],
    fitting_directions: [
      {
        title: "Mahsulot/UX-dizayn",
        one_liner: "ijodkorlik va tahlilni birlashtira olishing bu yerda bevosita ishlaydi",
      },
      { title: "Dasturlash va no-code", one_liner: "qiziquvchanlik + amaliyot = tez oʻsish" },
    ],
    surprise_hook:
      "Profilingga koʻra, sen, ehtimol, oʻylab koʻrmagan bitta yoʻnalish bor — aynan oʻsha yerda erkinlikka intilishing eng katta daromadga aylanishi mumkin. 🔒",
    surprise_direction_internal: "mahsulot tadbirkorligi / mikro-SaaS",
    locked_toc: [
      "Toʻliq psixologik portreting",
      "$2000+ maqsadiga olib boradigan 3 ta yoʻl",
      "Bu qancha turadi va qancha vaqt oladi",
      "Dastlabki 90 kunda nimani oʻrganish kerak",
      "Tajribasiz birinchi buyurtmani qanday olish mumkin",
      "Kutilmagan yoʻnalish va nega u aynan seniki",
      "Shu haftadayoq nima qilish kerak",
    ],
  },
};
