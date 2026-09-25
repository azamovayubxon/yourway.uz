import type { Dictionary } from "./ru";

// Словарь интерфейса: узбекский язык (латиница).
// Тексты лендинга и статических страниц — ЗАГЛУШКИ, нужна вычитка носителем языка.
// Буквы oʻ и gʻ пишутся знаком ʻ (U+02BB), остальные апострофы внутри слова — ʼ (U+02BC),
// например: taʼlim, maʼlumot. Обычный апостроф ' не используем.

export const uz: Dictionary = {
  meta: {
    title: "yourway.uz — qayoqqa borishingni bilib ol",
    description:
      "Testlardan bepul oʻt va shaxsiy yoʻnalishingni ol: kim ekansan, qaysi maqsad senga mos va unga qanday yetib borasan.",
  },
  common: {
    brand: "yourway.uz",
    startFree: "Bepul boshlash",
    backHome: "Bosh sahifaga",
    placeholderNote: "Vaqtinchalik matn: ishga tushirishdan oldin almashtiriladi.",
    language: "Til",
    menu: "Menyu",
  },
  footer: {
    howItWorks: "Bu qanday ishlaydi",
    pricing: "Narxlar",
    faq: "Savol-javob",
    offer: "Ommaviy oferta",
    privacy: "Maxfiylik siyosati",
    contactsTitle: "Aloqa",
    contactsValue: "Aloqa maʼlumotlari ishga tushirishdan oldin qoʻshiladi.",
    tagline: "Oʻzbekiston uchun imkoniyatlar navigatori.",
    rights: "Barcha huquqlar himoyalangan.",
  },
  landing: {
    hero: {
      title: "Kim boʻlishingni va unga qanday yetib borishni bilib ol",
      subtitle:
        "Shaxsiyat va qiziqishlar boʻyicha ilmiy testlar + sunʼiy intellekt tahlili. Portretingni va mos yoʻnalishlarni bepul ol, A nuqtadan B nuqtagacha shaxsiy yoʻlni esa toʻliq hisobotda.",
      note: "Roʻyxatdan oʻtmasdan · taxminan 20 daqiqa · shaxsiy maʼlumotlaringni yigʻmaymiz",
    },
    how: {
      title: "Bu qanday ishlaydi",
      steps: [
        {
          title: "Yoʻlni tanla",
          text: "Maqsadingni allaqachon bilasanmi yoki aniqlab olmoqchimisan, ayt.",
        },
        {
          title: "Testlardan oʻt",
          text: "Shaxsiyat, qiziqishlar, qadriyatlar va qanday oʻrganishing. Har ekranda bitta savol.",
        },
        {
          title: "Portretingni ol",
          text: "Bepul: tiping, kuchli tomonlaring va 2–3 ta mos yoʻnalish.",
        },
        {
          title: "Yoʻlni och",
          text: "Toʻliq hisobot: maqsad, qadamlar, muddat va xarajatlar (taxminiy), zaxira variantlar.",
        },
      ],
      more: "Batafsil",
    },
    sample: {
      title: "Hisobot namunasi",
      subtitle: "Bepul qismi shunday koʻrinadi. Maʼlumotlar oʻylab topilgan.",
      typeLabel: "Tadqiqotchi-yaratuvchi",
      typeCode: "INTP — Mantiqchi",
      portrait:
        "Sen narsalarning mohiyatiga yetishni va oʻzingnikini yaratishni yaxshi koʻrasan. Hammasi oldindan belgilab qoʻyilgan joyda zerikasan, yechim oʻylab topish kerak boʻlgan joyda esa qiziqasan.",
      strengthsTitle: "Kuchli tomonlar",
      strengths: ["Tahliliy fikrlash", "Mustaqillik", "Yangilikka qiziqish"],
      directionsTitle: "Mos yoʻnalishlar",
      directions: ["Maʼlumotlar tahlili", "Mahsulot ishlab chiqish", "Muhandislik"],
      lockedTitle: "Toʻliq hisobotda",
      locked: [
        "Maqsadni reallikka tekshirish",
        "Asosiy yoʻl: qadamlar va muddatlar",
        "Variantlar: shu yerda arzon / chet elda / onlayn",
        "Sen uchun kutilmagan yoʻnalish",
        "Shu haftaning oʻzida nima qilish kerak",
      ],
    },
    reviews: {
      title: "Fikrlar",
      note: "Fikrlar namunasi. Haqiqiylari ishga tushgandan keyin paydo boʻladi.",
      items: [
        {
          text: "Iqtisodga boraman deb oʻylagandim. Maʼlum boʻlishicha, menga dizayn yaqinroq ekan, yoʻl esa juda tushunarli edi.",
          author: "Abituriyent, 17 yosh",
        },
        {
          text: "Hammasi halol ekani yoqdi: summalar oraliqda berilgan va biror narsa chiqmasa, B rejasi ham bor.",
          author: "Talaba, 20 yosh",
        },
        {
          text: "Kasbimni oʻzgartirmoqchi edim. Hisobot katta pulsiz nimadan boshlashni koʻrsatdi.",
          author: "Ishlaydi, 28 yosh",
        },
      ],
    },
    pricing: {
      title: "Narxlar",
      subtitle: "Testlar va portret bepul. Faqat yoʻl koʻrsatilgan toʻliq hisobot uchun toʻlaysan.",
      oneTime: "bir martalik",
      plans: [
        {
          name: "Bepul",
          price: "0 soʻm",
          features: ["Barcha testlar", "Tiping va kuchli tomonlaring", "2–3 ta mos yoʻnalish"],
        },
        {
          name: "«Marshrut»",
          price: "29 000 soʻm",
          features: [
            "Maqsadini biladiganlar uchun",
            "Maqsadni reallikka tekshirish",
            "A nuqtadan B nuqtagacha yoʻl: qadamlar, muddat, xarajat",
            "Oʻzing va ota-onang uchun PDF",
          ],
        },
        {
          name: "«Navigator»",
          price: "79 000 soʻm",
          features: [
            "Oʻzini izlayotganlar uchun",
            "Asoslangan 2–3 ta maqsad tanlovi",
            "Eng yaxshi maqsadga yoʻl va variantlarni solishtirish",
            "Oʻzing va ota-onang uchun PDF",
          ],
        },
      ],
    },
    faq: {
      title: "Koʻp beriladigan savollar",
      items: [
        {
          q: "Bu rostdan ham bepulmi?",
          a: "Testlar va portret — ha, toʻliq. Faqat yoʻl koʻrsatilgan toʻliq hisobot pullik, uni sotib olmasang ham boʻladi.",
        },
        {
          q: "Qanday maʼlumotlarni yigʻasizlar?",
          a: "Biz F.I.Sh., telefon va elektron pochtani soʻramaymiz. Akkaunt — bu faqat login va parol, u faqat toʻlovdan oldin kerak boʻladi.",
        },
        {
          q: "Natijalar nimaga asoslangan?",
          a: "Tan olingan metodikalarga: Big Five (shaxsiyat) va Holland RIASEC testi (qiziqishlar). Ballar formulalar boʻyicha hisoblanadi, sunʼiy intellekt esa natijani tushunarli tilda tasvirlab beradi.",
        },
        {
          q: "Bu qancha vaqt oladi?",
          a: "Taxminan 20 daqiqa. Natija saqlanib boradi: sahifani yopib, keyinroq davom ettirish mumkin.",
        },
        {
          q: "Rus tilida oʻtsa boʻladimi?",
          a: "Ha. Butun sayt va hisobot oʻzbek va rus tillarida mavjud, tilni istalgan payt almashtirish mumkin.",
        },
      ],
      more: "Barcha savollar",
    },
    finalCta: {
      title: "Qayoqqa borishingni bilib ol",
      text: "Birinchi natija — bepul, 20 daqiqadan keyinoq.",
    },
  },
  pages: {
    howItWorks: {
      title: "Bu qanday ishlaydi",
      intro:
        "yourway.uz — imkoniyatlar navigatori. Oliygoh, kurslar, frilans yoki oʻz biznesing — bular maqsad emas, vosita. Biz qayoqqa borish va unga qanday yetib borishni tushunishga yordam beramiz.",
      honestyTitle: "Natijalar haqida halol",
      honesty:
        "Hisobotdagi summa va muddatlar — taxminiy oraliqlar. Hisobot maslahat beradi, lekin sen uchun qaror qabul qilmaydi.",
    },
    pricing: {
      title: "Narxlar",
      intro: "Hech qanday obuna yoʻq: bitta hisobot uchun bir marta toʻlaysan.",
      paymentNote: "Toʻlov usullari (Payme, Click, Uzum) ishga tushirishdan oldin qoʻshiladi.",
    },
    faq: {
      title: "Koʻp beriladigan savollar",
    },
    offer: {
      title: "Ommaviy oferta",
      body: [
        "Bu yerda ommaviy oferta matni boʻladi. Uni ishga tushirishdan oldin yurist tayyorlaydi.",
        "Oferta xizmat koʻrsatish shartlari, toʻlov va pulni qaytarish tartibini tavsiflaydi.",
      ],
    },
    privacy: {
      title: "Maxfiylik siyosati",
      body: [
        "Bu yerda maxfiylik siyosati matni boʻladi. Uni ishga tushirishdan oldin yurist tayyorlaydi.",
        "Qisqasi: biz F.I.Sh., telefon va elektron pochtani yigʻmaymiz. Testlarga javoblaring faqat hisobotingni tuzish uchun ishlatiladi. Akkauntni barcha maʼlumotlar bilan birga oʻchirish mumkin.",
      ],
    },
  },
  start: {
    subtitle: "Testlar hamma uchun bir xil. Javobingga faqat oxirida qaysi hisobotni tavsiya qilishimiz bogʻliq.",
    hints: {
      knows_goal: "Maqsadingni reallikka tekshiramiz va unga yoʻl quramiz.",
      no_goal: "Senga mos maqsadlarni va eng yaxshisiga olib boradigan yoʻlni topamiz.",
    },
    note: "4 ta test · 110 ta savol · taxminan 20 daqiqa. Roʻyxatdan oʻtmasdan. Natijalar avtomatik saqlanadi.",
    resumeTitle: "Davom ettiramizmi?",
    resumeText: "{total} ta savoldan {done} tasiga javob berilgan. Toʻxtagan joyingdan davom ettirishing mumkin.",
    resume: "Davom ettirish",
    restart: "Qaytadan boshlash",
    doneTitle: "Testlar yakunlandi!",
    doneText: "Keyingi qadam — sen, imkoniyatlaring va maqsading haqida qisqa soʻrovnoma.",
    continueToSurvey: "Keyingisi: soʻrovnoma",
    surveyDoneTitle: "Profil tayyor!",
    surveyDoneText: "Testlar va soʻrovnoma oʻtildi, profil tuzildi. Keyingi qadam — bepul sunʼiy intellekt portreti — ishlab chiqishning keyingi bosqichida paydo boʻladi.",
  },
  test: {
    parts: {
      big_five: "Shaxsiyat",
      riasec: "Qiziqishlar",
      values: "Qadriyatlar",
      perception: "Qanday oʻrganasan",
    },
    prompts: {
      big_five: "Bu qanchalik sen haqingda?",
      riasec: "Bu senga qanchalik qiziq?",
      values: "Bu sen uchun qanchalik muhim?",
      perception: "Bu qanchalik sen haqingda?",
    },
    partOf: "{total} qismdan {n}-qism",
    questionOf: "{total} ta savoldan {n}-savol",
    back: "Orqaga",
    offline: "Aloqa yoʻq. Javoblar shu qurilmada saqlandi va aloqa tiklanganda yuboriladi.",
    sessionLost: "Bu sessiya endi faol emas: ehtimol, testlar boshqa oynada qaytadan boshlangan.",
    reload: "Sahifani yangilash",
    saving: "Oxirgi javoblar saqlanmoqda…",
    devLink: "Hisoblangan ballarni koʻrish (ishlab chiqish uchun sahifa)",
  },
  survey: {
    next: "Keyingisi",
    skip: "Oʻtkazib yuborish",
    back: "Orqaga",
    partOf: "{total} qismdan {n}-qism",
    questionOf: "{total} ta savoldan {n}-savol",
    numberRange: "{min} dan {max} gacha son",
    offline: "Aloqa yoʻq. Javoblar shu qurilmada saqlandi va aloqa tiklanganda yuboriladi.",
    sessionLost: "Bu sessiya endi faol emas: ehtimol, soʻrovnoma boshqa oynada qaytadan boshlangan.",
    reload: "Sahifani yangilash",
    saving: "Oxirgi javoblar saqlanmoqda…",
    devLink: "Tuzilgan profilni koʻrish (ishlab chiqish uchun sahifa)",
    doneTitle: "Soʻrovnoma yakunlandi!",
    doneText: "Profil tayyor. Keyingi qadam — bepul sunʼiy intellekt portreti — ishlab chiqishning keyingi bosqichida paydo boʻladi.",
  },
  devProfile: {
    title: "Sessiya ballari",
    note: "Hisoblashni tekshirish uchun xizmat sahifasi. Asosiy saytda ochilmaydi.",
    session: "Sessiya",
    pathType: "Tanlangan yoʻl",
    status: "Holat",
    answered: "Javob berilgan savollar",
    notDone: "Testlar toʻliq yakunlanmagan. Ballar 110 ta savolning barchasiga javob berilgandan keyin paydo boʻladi.",
    bigFive: "Big Five (shaxsiyat)",
    bigFiveNames: {
      neuroticism: "Neyrotizm",
      extraversion: "Ekstraversiya",
      openness: "Ochiqlik",
      agreeableness: "Xushmuomalalik",
      conscientiousness: "Masʼuliyatlilik",
    },
    levels: { low: "past", medium: "oʻrta", high: "yuqori" },
    rawSum: "yigʻindi",
    sixteenType: "16 tip",
    weakAxes: "Kuchsiz ifodalangan oʻqlar (faqat ichki maʼlumotlarda)",
    none: "yoʻq",
    riasec: "RIASEC (qiziqishlar)",
    code: "Kod",
    values: "Qadriyatlar (muhimdan kamroq muhimga)",
    learningStyle: "Idrok uslubi",
    points: "ball",
    json: "Barcha maʼlumotlar (JSON)",
    surveyTitle: "Kontekst soʻrovnomasi",
    profileNotDone: "Soʻrovnoma toʻliq yakunlanmagan. Profil soʻrovnomaning barcha savollariga javob berilgandan keyin paydo boʻladi.",
    profileTitle: "Sunʼiy intellekt uchun profil (Ilova A §9)",
    languageLabel: "Profil tili",
    level: "Standart daraja",
    answerQuality: "Javoblar sifati",
    answerQualityLow: "shubhali bir xil javoblar: {tests}",
    answerQualityOk: "izohsiz",
    demographics: "Demografiya",
    resources: "Resurslar",
    goal: "Maqsad",
    profileJson: "Butun profil (JSON)",
  },
  notFound: {
    title: "Sahifa topilmadi",
    text: "Havola eskirgan boʻlishi mumkin.",
  },
};
