// Образец полного отчёта для тестового режима ИИ (AI_MODE=mock или нет ANTHROPIC_API_KEY),
// его по частям отдаёт поставщик providers/mock.ts.
//
// RU — правдоподобная заглушка по схеме Приложения Б §7 для профиля из golden example (§9):
// 19 лет, IAE, высокая открытость, цель — фриланс. Обращение на «вы».
// UZ — тот же отчёт, написанный заново по-узбекски в стиле docs/uz-style.md: только «siz»,
// без английских слов и калек (решение (Н) в CLAUDE.md).
// ⚠️ ТЕКСТ ДЛЯ ВЫЧИТКИ НОСИТЕЛЕМ (строки mock.report.* в docs/uz-texts.csv). Используется только в тестовом режиме.
//
// Цель и проверка цели — в двух вариантах: «stated» (knows_goal: своя цель) и «constructed»
// (no_goal: цели подобраны, решение (З)).

import type { FinishPart, MainPathPart, PortraitGoalPart } from "./report-schema";
import type { TeaserLanguage } from "./teaser-schema";

export interface MockReport {
  portrait: PortraitGoalPart["portrait"];
  goal: { stated: PortraitGoalPart["goal"]; constructed: PortraitGoalPart["goal"] };
  reality_check: { stated: PortraitGoalPart["reality_check"]; constructed: PortraitGoalPart["reality_check"] };
  main_path: MainPathPart;
  finish: FinishPart;
}

export const MOCK_REPORTS: Record<TeaserLanguage, MockReport> = {
  ru: {
    portrait: {
      type_label: "Исследователь-Творец",
      summary:
        "Судя по вашей очень высокой открытости (88 %) и коду интересов IAE, вы из тех, кто сначала разбирается, как всё устроено, а потом делает по-своему. Исследовательская жилка (I) даёт вам аналитику, творческая (A) — вкус и желание создавать, а предприимчивая (E) — готовность продавать результат. Свобода и деньги для вас на первых местах, стабильность — ближе к концу: вам подходит путь, где доход растёт вместе с навыком, а не с выслугой лет. Средняя добросовестность (55 %) означает, что вы способны на сильные рывки, но длинный маршрут лучше дробить на короткие этапы с видимым результатом.",
      strengths: [
        "Быстро осваиваете новые инструменты и идеи",
        "Соединяете анализ и творчество: видите и логику, и красоту решения",
        "Учитесь через практику — быстрее всего растёте на реальных задачах",
        "Готовы на умеренный риск и не боитесь пробовать новое",
      ],
      watchouts: [
        "Интерес к новому может уводить от начатого: без коротких дедлайнов проекты рискуют остаться незаконченными",
        "Экстраверсия ниже средней: разговоры с клиентами и продажи потребуют осознанной тренировки",
        "Тяга к свободе иногда мешает выстроить режим — а во фрилансе режим и есть ваш начальник",
      ],
    },
    goal: {
      stated: {
        source: "stated",
        statement:
          "Через 2 года стабильно зарабатывать на фрилансе или удалённой работе ориентировочно $1500–2000 в месяц, проектируя цифровые продукты для зарубежных и местных клиентов",
        constructed_options: [],
      },
      constructed: {
        source: "constructed",
        statement:
          "За 1,5–2 года стать дизайнером цифровых продуктов (UX/UI) и выйти на удалённой работе или фрилансе на доход ориентировочно $1000–2000 в месяц",
        constructed_options: [
          {
            goal: "Дизайн цифровых продуктов (UX/UI) — рекомендуем",
            why_fits:
              "Очень высокая открытость (88 %) и код IAE просят работы, где анализ соединяется с творчеством, а удалённый формат поддерживает вашу главную ценность — свободу.",
          },
          {
            goal: "No-code разработка сайтов и приложений",
            why_fits:
              "Вы учитесь через практику и любите быстро видеть результат, а предприимчивость (E) поможет продавать этот навык клиентам.",
          },
          {
            goal: "Digital-маркетинг и контент",
            why_fits:
              "Есть творческий интерес и тяга к влиянию, но экстраверсия ниже средней сделает этот путь чуть тяжелее остальных.",
          },
        ],
      },
    },
    reality_check: {
      stated: {
        verdict: "ambitious",
        explanation:
          "Цель хорошо совпадает с вашим профилем: открытость, исследовательско-творческие интересы и ценность свободы — ровно то, что нужно в дизайне и во фрилансе. Амбициозна она по срокам и стартовым условиям: бюджет низкий, английский базовый, опыта заказов пока нет. За 2 года при 20 часах в неделю выйти на доход ориентировочно $1500–2000 в месяц реально, но для этого нужны портфолио из 5–7 сильных работ, английский на уровне B1–B2 и выход на зарубежные площадки. Если держать темп, шансы выше средних.",
        adjustment:
          "Разбейте цель на ступени: через 6 месяцев — первые платные заказы (ориентировочно $100–300 в месяц), через 12 — ориентировочно $500–800, через 24 — $1500–2000. Если к 12-му месяцу рост медленнее, это не провал: сдвиньте финальный срок на 6–12 месяцев или добавьте частичную занятость в местной студии.",
      },
      constructed: {
        verdict: "fits",
        explanation:
          "Рекомендованная цель хорошо совпадает с профилем: она опирается на ваши сильные стороны и ведёт к тому, что вы цените, — свободе и доходу. Низкий стартовый бюджет не помеха: путь можно начать с бесплатных и недорогих материалов. Главное условие — 15–20 часов регулярной практики в неделю и подъём английского.",
        adjustment: "",
      },
    },
    main_path: {
      main_path: {
        summary:
          "Вы идёте из точки «студент с интересом к дизайну и технологиям, без портфолио» в точку «самостоятельный дизайнер цифровых продуктов с зарубежными клиентами». Ядро маршрута — навыки UX/UI-дизайна и основы no-code, портфолио из реальных задач и параллельный подъём английского. Ниже — три варианта под разные вводные; их можно сочетать.",
        routes: [
          {
            type: "local_cheap",
            title: "Здесь и недорого: самообучение и местные заказы",
            steps: [
              "Месяцы 1–2: бесплатные уроки по основам интерфейсов и Figma (YouTube, бесплатный режим курсов на платформах уровня Coursera) — 8–10 часов в неделю",
              "Месяцы 2–4: 3 учебных проекта на реальные задачи — редизайн сайта местного кафе, приложение для записи в салон, лендинг для учебного центра",
              "Месяцы 3–6: 1–2 бесплатных или символически оплачиваемых проекта для знакомых предпринимателей — взамен отзыв и право показывать работу в портфолио",
              "Месяцы 5–8: профиль в Telegram-каналах с заказами и на фриланс-биржах, первые платные заказы",
              "Всё это время: английский по 30–40 минут в день (приложения, сериалы с субтитрами, разговорный клуб)",
            ],
            time_estimate: "ориентировочно 6–9 месяцев до первых регулярных заказов",
            cost_range: "ориентировочно 0–500 000 сум (интернет, иногда платный шаблон или урок)",
            requirements: ["Компьютер или ноутбук, на котором работает Figma в браузере", "20 часов в неделю"],
            outcome: "Портфолио из 4–6 работ, первые клиенты в Узбекистане и доход ориентировочно 1–4 млн сум в месяц",
            effort_level: "easy",
            tradeoff_note:
              "Лёгкий путь почти ничего не стоит, но потолок у местного рынка ниже: чтобы выйти на $1500–2000, всё равно понадобится шаг к зарубежным клиентам.",
          },
          {
            type: "online",
            title: "Онлайн для занятых: системный курс и зарубежные площадки",
            steps: [
              "Месяцы 1–6: структурированная онлайн-программа по UX/UI с проверкой работ наставником (международные платформы или сильные онлайн-школы на русском) — 12–15 часов в неделю",
              "Месяцы 3–9: английский до уровня B1–B2 с преподавателем онлайн, 2 занятия в неделю",
              "Месяцы 6–10: кейсы для портфолио на английском, профиль на Behance и Dribbble",
              "Месяцы 9–14: профиль на международных фриланс-площадках, 10–15 откликов в неделю, первые отзывы даже по невысокой ставке",
              "Месяцы 14–24: повышение ставки после каждых 3–5 успешных проектов, постоянные клиенты",
            ],
            time_estimate: "ориентировочно 12–24 месяца до дохода $1500–2000 в месяц",
            cost_range: "ориентировочно $300–900 за курс и $40–100 в месяц на английский",
            requirements: [
              "Английский хотя бы A2 на старте и B1+ к выходу на площадки",
              "Дисциплина: 15–20 часов в неделю без долгих пауз",
            ],
            outcome:
              "Международное портфолио, отзывы на площадках и доход ориентировочно $800–2000 в месяц к концу второго года",
            effort_level: "hard",
            tradeoff_note:
              "Сложный путь тяжелее и дороже, зато выводит на рынок, где ваша цель реальна: ставки там в разы выше местных.",
          },
          {
            type: "abroad",
            title: "За рубежом: учёба на программе по дизайну",
            steps: [
              "Изучить программы по дизайну интерфейсов в Турции, Южной Корее, Польше или Германии и их языковые требования",
              "Сдать IELTS на 6.0–6.5 (или экзамен на язык страны) — ориентировочно 6–12 месяцев подготовки",
              "Собрать для поступления портфолио из 8–10 работ",
              "Подать документы на гранты и стипендии (государственные стипендии стран, программы вузов)",
              "Во время учёбы — стажировки и фриланс-заказы в пределах разрешённых часов",
            ],
            time_estimate: "ориентировочно 1–1,5 года подготовки и 2–4 года учёбы",
            cost_range:
              "ориентировочно $3000–15 000 в год за контракт и $4000–10 000 в год на проживание и питание — зависит от страны; с грантом заметно меньше",
            requirements: [
              "IELTS 6.0–6.5 или экзамен на язык страны",
              "Портфолио для поступления",
              "Готовность к переезду — сейчас вы указали, что переезд не рассматриваете",
            ],
            outcome: "Диплом, международная среда и стажировки, выход на рынок труда другой страны",
            effort_level: "hard",
            tradeoff_note:
              "Самый дорогой и долгий путь, и он не совпадает с вашим «без переезда». Держите его как запасной: он имеет смысл, если выиграете грант.",
          },
        ],
      },
    },
    finish: {
      main_path: {
        learning_advice:
          "Вы лучше всего учитесь через практику, поэтому правило простое: на каждый час теории — два часа своей работы. Посмотрели урок — сразу повторите его в Figma на своём проекте. Берите «учебный заказ» ещё до того, как почувствуете себя готовым: реальная задача научит быстрее курса. Раз в неделю показывайте работу сообществу дизайнеров и просите разбор. Чтобы не бросать начатое, работайте короткими циклами: одна мини-цель на 2 недели и публичный результат в конце.",
        future_outlook:
          "ИИ уже умеет генерировать макеты и тексты, поэтому простая «отрисовка экранов» дешевеет. Растёт спрос на тех, кто понимает пользователя, умеет исследовать и проектировать решение целиком, а ИИ использует как ускоритель. Ваше сочетание исследовательского (I) и творческого (A) склада — как раз про это. Если развиваться в сторону продуктового мышления, а не только визуала, риск для направления умеренный.",
      },
      alternatives: [
        {
          direction: "Свой небольшой цифровой продукт (сервис по подписке или шаблоны)",
          why_you:
            "У вас высокая открытость, предприимчивость (E) в коде интересов и свобода на первом месте. Навыки дизайна и no-code позволяют самому собрать простой продукт — например, шаблоны для Telegram-магазинов или сервис записи для салонов — без команды программистов.",
          potential:
            "Продукт работает, даже когда вы отдыхаете: при удаче доход может обогнать фриланс и перестать зависеть от часов работы. Реалистично — ориентировочно $200–1000 в месяц в первый год, если найдёте свою нишу.",
          first_steps: [
            "Выпишите 10 повторяющихся проблем знакомых предпринимателей",
            "За два выходных соберите на no-code прототип решения одной из них",
            "Покажите его 5 людям и спросите, готовы ли они платить",
          ],
        },
      ],
      act_now: [
        "Сегодня: установите Figma и пройдите первый бесплатный урок по интерфейсам (1–2 часа)",
        "На этой неделе: выберите одно местное заведение и сделайте редизайн его главного экрана — это первая работа в портфолио",
        "Заведите таблицу прогресса: часы в неделю, навыки, работы в портфолио",
        "Запишитесь в разговорный клуб английского или найдите партнёра по языку",
        "Подпишитесь на 3 Telegram-канала с заказами для дизайнеров и понаблюдайте, что просят и сколько платят",
      ],
      disclaimer:
        "Рекомендации носят информационный характер и не являются гарантией трудоустройства или дохода. Суммы и сроки ориентировочные. Финальное решение — за вами.",
    },
  },
  uz: {
    portrait: {
      type_label: "Izlanuvchan ijodkor",
      summary:
        "Yangilikka ochiqligingiz juda yuqori (88 %), qiziqishlar kodingiz esa IAE — yaʼni siz avval narsaning qanday ishlashini tushunib olasiz, keyin uni oʻzingizcha qilasiz. Tadqiqotchilik (I) sizga tahlil qilish qobiliyatini, ijodkorlik (A) did va yaratish istagini, tadbirkorlik (E) esa natijani sota olishni beradi. Siz uchun erkinlik va pul birinchi oʻrinda, barqarorlik esa keyinroq: daromad yillar oʻtishi bilan emas, mahoratingiz bilan birga oʻsadigan yoʻl sizga mos. Masʼuliyatlilik oʻrtacha (55 %): siz qisqa vaqtda katta kuch bilan ishlay olasiz, lekin uzoq yoʻlni natijasi koʻrinadigan qisqa bosqichlarga boʻlgan maʼqul.",
      strengths: [
        "Yangi dastur va gʻoyalarni tez oʻzlashtirasiz",
        "Tahlil va ijodni birlashtirasiz: yechimning ham mantiqini, ham chiroyini koʻrasiz",
        "Amalda oʻrganasiz — haqiqiy vazifalarda eng tez oʻsasiz",
        "Oʻylab tavakkal qilishga va yangi narsani sinab koʻrishga tayyorsiz",
      ],
      watchouts: [
        "Yangilikka qiziqish boshlangan ishdan chalgʻitishi mumkin: qisqa muddatlar qoʻymasangiz, loyihalar chala qolib ketadi",
        "Kirishimlilik oʻrtachadan past: mijozlar bilan gaplashish va savdolashishni ataylab mashq qilishga toʻgʻri keladi",
        "Erkinlikka intilish baʼzan kun tartibini tuzishga xalaqit beradi — frilansda esa kun tartibi sizning rahbaringiz",
      ],
    },
    goal: {
      stated: {
        source: "stated",
        statement:
          "2 yil ichida frilans yoki masofaviy ishda xorijiy va mahalliy mijozlar uchun raqamli mahsulotlar dizaynini qilib, oyiga taxminan $1500–2000 barqaror daromad topish",
        constructed_options: [],
      },
      constructed: {
        source: "constructed",
        statement:
          "1,5–2 yil ichida raqamli mahsulotlar dizayneri (UX/UI) boʻlib, masofaviy ish yoki frilansda oyiga taxminan $1000–2000 daromadga chiqish",
        constructed_options: [
          {
            goal: "Raqamli mahsulotlar dizayni (UX/UI) — tavsiya qilamiz",
            why_fits:
              "Yangilikka juda yuqori ochiqlik (88 %) va IAE kodi tahlil bilan ijod birga keladigan ishni talab qiladi, masofadan ishlash esa eng muhim qadriyatingiz — erkinlikka mos.",
          },
          {
            goal: "Kod yozmasdan sayt va ilova yaratish",
            why_fits:
              "Siz qilib koʻrib oʻrganasiz va natijani tez koʻrishni yoqtirasiz, tadbirkorlik (E) esa bu mahoratni mijozlarga sotishga yordam beradi.",
          },
          {
            goal: "Raqamli marketing va kontent",
            why_fits:
              "Ijodga va odamlarga taʼsir oʻtkazishga qiziqishingiz bor, lekin kirishimlilik oʻrtachadan past boʻlgani uchun bu yoʻl boshqalaridan ogʻirroq boʻlishi mumkin.",
          },
        ],
      },
    },
    reality_check: {
      stated: {
        verdict: "ambitious",
        explanation:
          "Maqsadingiz profilingizga yaxshi mos keladi: yangilikka ochiqlik, tadqiqotchi va ijodkor qiziqishlar, erkinlikni qadrlash — dizayn va frilans uchun aynan kerakli sifatlar. Maqsad muddat va boshlangʻich sharoit jihatidan katta: byudjet kam, ingliz tili boshlangʻich darajada, hali buyurtma bilan ishlamagansiz. Haftasiga 20 soatdan ishlasangiz, 2 yilda oyiga taxminan $1500–2000 ga chiqish real, lekin buning uchun 5–7 ta kuchli ishdan iborat portfolio, B1–B2 darajadagi ingliz tili va xorijiy saytlarga chiqish kerak. Surʼatni saqlasangiz, imkoniyatingiz oʻrtachadan yuqori.",
        adjustment:
          "Maqsadni bosqichlarga boʻling: 6 oydan keyin — birinchi pullik buyurtmalar (oyiga taxminan $100–300), 12 oydan keyin — taxminan $500–800, 24 oydan keyin — $1500–2000. Agar 12-oyga kelib oʻsish sekinroq boʻlsa, bu muvaffaqiyatsizlik emas: yakuniy muddatni 6–12 oyga suring yoki mahalliy studiyada yarim stavkada ishlashni qoʻshing.",
      },
      constructed: {
        verdict: "fits",
        explanation:
          "Tavsiya qilingan maqsad profilingizga yaxshi mos: u kuchli tomonlaringizga tayanadi va siz qadrlaydigan narsalarga — erkinlik va daromadga olib boradi. Boshlangʻich byudjet kamligi toʻsiq emas: bu yoʻlni bepul va arzon manbalardan boshlash mumkin. Asosiy shart — haftasiga 15–20 soat muntazam mashq qilish va ingliz tilini koʻtarish.",
        adjustment: "",
      },
    },
    main_path: {
      main_path: {
        summary:
          "Siz «dizayn va texnologiyaga qiziqadigan, hali portfoliosi yoʻq talaba»dan «xorijiy mijozlari bor mustaqil raqamli mahsulotlar dizayneri»ga qarab yoʻl olasiz. Yoʻlning asosi — interfeys dizayni (UX/UI) va kod yozmasdan ilova yigʻish mahorati, haqiqiy vazifalardan tuzilgan portfolio va shu bilan birga ingliz tilini koʻtarish. Quyida turli sharoitlar uchun uchta yoʻl bor, ularni birga qoʻshsa ham boʻladi.",
        routes: [
          {
            type: "local_cheap",
            title: "Shu yerda va arzon: mustaqil oʻqish va mahalliy buyurtmalar",
            steps: [
              "1–2-oylar: interfeys dizayni va Figma asoslari boʻyicha bepul darslar (YouTube, Coursera kabi platformalardagi bepul kurslar) — haftasiga 8–10 soat",
              "2–4-oylar: haqiqiy vazifalar asosida 3 ta oʻquv loyihasi — mahalliy kafe saytini qayta chizish, salonga yozilish ilovasi, oʻquv markazi uchun sahifa",
              "3–6-oylar: tanish tadbirkorlar uchun 1–2 ta bepul yoki arzon loyiha — evaziga fikr-mulohaza va ishni portfolioda koʻrsatish huquqi",
              "5–8-oylar: buyurtmalar chiqadigan Telegram kanallarida va frilans saytlarida profil ochish, birinchi pullik buyurtmalar",
              "Shu vaqt davomida: har kuni 30–40 daqiqa ingliz tili (ilovalar, subtitrli seriallar, suhbat klubi)",
            ],
            time_estimate: "taxminan 6–9 oy — muntazam buyurtmalar paydo boʻlguncha",
            cost_range: "taxminan 0–500 000 soʻm (internet, baʼzan pullik shablon yoki dars)",
            requirements: ["Brauzerda Figma bilan ishlay oladigan kompyuter yoki noutbuk", "Haftasiga 20 soat"],
            outcome:
              "4–6 ta ishdan iborat portfolio, Oʻzbekistondagi birinchi mijozlar va oyiga taxminan 1–4 mln soʻm daromad",
            effort_level: "easy",
            tradeoff_note:
              "Oson yoʻl deyarli pul talab qilmaydi, lekin mahalliy bozorda daromad chegarasi pastroq: $1500–2000 ga chiqish uchun baribir xorijiy mijozlar tomon qadam qoʻyishga toʻgʻri keladi.",
          },
          {
            type: "online",
            title: "Band odamlar uchun onlayn: tizimli kurs va xorijiy saytlar",
            steps: [
              "1–6-oylar: ishlaringizni ustoz tekshirib boradigan tizimli onlayn kurs (xalqaro platformalar yoki kuchli onlayn maktablar) — haftasiga 12–15 soat",
              "3–9-oylar: onlayn oʻqituvchi bilan ingliz tilini B1–B2 darajagacha koʻtarish, haftasiga 2 ta dars",
              "6–10-oylar: portfolio uchun ingliz tilida ish tavsiflari, Behance va Dribbble saytlarida profil",
              "9–14-oylar: xalqaro frilans saytlarida profil, haftasiga 10–15 ta taklif yuborish, narx past boʻlsa ham birinchi ijobiy fikrlarni yigʻish",
              "14–24-oylar: har 3–5 ta muvaffaqiyatli loyihadan keyin narxni oshirish, doimiy mijozlar orttirish",
            ],
            time_estimate: "taxminan 12–24 oy — oyiga $1500–2000 daromadgacha",
            cost_range: "taxminan kurs uchun $300–900 va ingliz tili uchun oyiga $40–100",
            requirements: [
              "Boshida kamida A2, saytlarga chiqqanda B1 dan yuqori ingliz tili",
              "Intizom: haftasiga 15–20 soat, uzoq tanaffuslarsiz",
            ],
            outcome:
              "Xalqaro portfolio, saytlardagi ijobiy fikrlar va ikkinchi yil oxiriga kelib oyiga taxminan $800–2000 daromad",
            effort_level: "hard",
            tradeoff_note:
              "Qiyin yoʻl ogʻirroq va qimmatroq, lekin maqsadingiz real boʻlgan bozorga olib chiqadi: u yerda narxlar mahalliy bozordagidan bir necha barobar yuqori.",
          },
          {
            type: "abroad",
            title: "Xorijda: dizayn yoʻnalishida oʻqish",
            steps: [
              "Turkiya, Janubiy Koreya, Polsha yoki Germaniyadagi interfeys dizayni dasturlari va ularning til talablarini oʻrganib chiqish",
              "IELTS dan 6.0–6.5 ball olish (yoki oʻsha davlat tilidan imtihon topshirish) — taxminan 6–12 oylik tayyorgarlik",
              "Oʻqishga kirish uchun 8–10 ta ishdan iborat portfolio yigʻish",
              "Grant va stipendiyalarga hujjat topshirish (davlat stipendiyalari, universitet dasturlari)",
              "Oʻqish davomida ruxsat etilgan soatlarda amaliyot oʻtash va frilans buyurtmalar olish",
            ],
            time_estimate: "taxminan 1–1,5 yil tayyorgarlik va 2–4 yil oʻqish",
            cost_range:
              "taxminan yiliga $3000–15 000 kontrakt va yiliga $4000–10 000 yashash va ovqatlanishga — davlatga qarab; grant bilan ancha kam",
            requirements: [
              "IELTS 6.0–6.5 yoki oʻsha davlat tilidan imtihon",
              "Oʻqishga kirish uchun portfolio",
              "Boshqa davlatga koʻchishga tayyorlik — hozircha siz koʻchishni oʻylamayotganingizni aytgansiz",
            ],
            outcome: "Diplom, xalqaro muhit va amaliyot, boshqa davlat mehnat bozoriga chiqish",
            effort_level: "hard",
            tradeoff_note:
              "Eng qimmat va eng uzoq yoʻl, u «koʻchmasdan» degan shartingizga ham toʻgʻri kelmaydi. Uni zaxira sifatida saqlang: grant yutsangiz, bu yoʻl oʻzini oqlaydi.",
          },
        ],
      },
    },
    finish: {
      main_path: {
        learning_advice:
          "Siz eng yaxshi qilib koʻrib oʻrganasiz, shuning uchun qoida oddiy: nazariyaga ketgan har bir soatga oʻz ishingizga ikki soat toʻgʻri kelsin. Darsni koʻrdingizmi — darhol uni Figmaʼda oʻz loyihangizda takrorlang. Oʻzingizni tayyor his qilmasdan oldin ham «oʻquv buyurtmasi»ni oling: haqiqiy vazifa kursdan tezroq oʻrgatadi. Haftada bir marta ishingizni dizaynerlar hamjamiyatiga koʻrsatib, fikr soʻrang. Boshlagan ishni tashlab qoʻymaslik uchun qisqa davrlar bilan ishlang: 2 haftaga bitta kichik maqsad va oxirida hammaga koʻrinadigan natija.",
        future_outlook:
          "Sunʼiy intellekt allaqachon maket va matnlarni yarata oladi, shuning uchun oddiy «ekran chizish» arzonlashmoqda. Foydalanuvchini tushunadigan, izlanish olib boradigan va yechimni toʻliq loyihalaydigan, sunʼiy intellektdan esa ishni tezlashtirish uchun foydalanadigan odamlarga talab oʻsib bormoqda. Sizdagi tadqiqotchi (I) va ijodkor (A) tomonlar aynan shu haqida. Faqat chiroyli tasvirga emas, mahsulot haqida oʻylashga qarab rivojlansangiz, bu yoʻnalishdagi xavf oʻrtacha.",
      },
      alternatives: [
        {
          direction: "Oʻzingizning kichik raqamli mahsulotingiz (obunali xizmat yoki shablonlar)",
          why_you:
            "Yangilikka ochiqligingiz yuqori, qiziqishlar kodingizda tadbirkorlik (E) bor, erkinlik esa birinchi oʻrinda. Dizayn va kod yozmasdan ilova yigʻish mahorati bilan dasturchilarsiz oddiy mahsulotni oʻzingiz yigʻa olasiz — masalan, Telegram doʻkonlari uchun shablonlar yoki salonlarga yozilish xizmati.",
          potential:
            "Mahsulot siz dam olayotganingizda ham ishlaydi: omadingiz kelsa, daromad frilansdan oshib ketadi va ish soatlaringizga bogʻliq boʻlmay qoladi. Real baho — oʻz boʻshligʻingizni topsangiz, birinchi yili oyiga taxminan $200–1000.",
          first_steps: [
            "Tanish tadbirkorlarning takrorlanib turadigan 10 ta muammosini yozib chiqing",
            "Ulardan birining yechimini ikki dam olish kunida kod yozmasdan yigʻib koʻring",
            "Uni 5 kishiga koʻrsatib, pul toʻlashga tayyormi yoki yoʻqmi — soʻrang",
          ],
        },
      ],
      act_now: [
        "Bugun: Figmaʼni oʻrnating va interfeys boʻyicha birinchi bepul darsni oʻting (1–2 soat)",
        "Shu hafta: bitta mahalliy muassasani tanlang va uning bosh sahifasini qayta chizing — bu portfoliodagi birinchi ish boʻladi",
        "Oʻsish jadvalini yuriting: haftalik soatlar, oʻrgangan narsalar, portfoliodagi ishlar",
        "Ingliz tili suhbat klubiga yoziling yoki til boʻyicha sherik toping",
        "Dizaynerlar uchun buyurtmalar chiqadigan 3 ta Telegram kanalga obuna boʻling va nimalar soʻralayotgani, qancha toʻlanayotganini kuzatib boring",
      ],
      disclaimer:
        "Tavsiyalar maʼlumot uchun berilgan va ishga joylashish yoki daromadni kafolatlamaydi. Summalar va muddatlar taxminiy. Yakuniy qaror sizniki.",
    },
  },
};
