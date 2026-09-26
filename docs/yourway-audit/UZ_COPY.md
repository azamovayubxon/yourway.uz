# YourWay — узбекские тексты и языковая редактура

Приложение к YOURWAY_TZ.md. Проверка 26 сентября 2026 года.

## 1. Редакционный принцип

Писать на естественном современном узбекском языке, обращаться на `siz`, объяснять пользу конкретными словами. Не переводить русские конструкции слово в слово. Не называть человека «слабым», «неподходящим», «низкоответственным» на основании результата анкеты.

Тексты ниже — предложенная редакция, а не сертифицированная локализация психометрического инструмента. Для UI они готовы к редакционному внедрению. Для вопросов теста требуется сверка с оригинальным пунктом и его ключом, затем проверка носителем языка. Не менять измеряемый смысл ради красивого звучания.

## 2. Ошибки и тяжёлые формулировки в тесте

Нумерация — фактически показанный порядок 110 вопросов в проверенном сеансе. При наличии рандомизации разработчик должен сопоставить текст со стабильным ID. Замены не следует искать только по номеру.

| № | Сейчас | Проблема | Предлагаемая редакция для сверки |
|---|---|---|---|
| 2 | `Koʻp vaziyatlarda oʻzimni xotirjam va boʻshashgan his qilaman.` | `boʻshashgan` может звучать как «ослабевший», а не расслабленный | `Koʻp vaziyatlarda oʻzimni xotirjam va erkin his qilaman.` |
| 8 | `Atrofdagilar men haqimda nima deb oʻylashini bilish meni bezovta qilmaydi.` | Добавлен смысл «знание того, что думают»; проверить оригинал | `Atrofdagilarning men haqimda nima deb oʻylashi meni unchalik tashvishlantirmaydi.` |
| 9 | `Zararli ekanligini bilsam ham vasvasalarga qarshilik qilish menga qiyin.` | `vasvasa` несёт лишние оттенки; неясно, что оценивается | `Zararli ekanini bilsam ham, ayrim istaklarimga qarshi turishim qiyin.` |
| 10 | `Men oʻzining impulsiv istaklarini yaxshi nazorat qilaman.` | Ошибка согласования первого и третьего лица | `Men toʻsatdan paydo boʻladigan istaklarimni yaxshi nazorat qilaman.` |
| 12 | `Sezilarli bosim ostida ham fikrning ravshanligini saqlab qolaman.` | Канцелярская калька | `Kuchli bosim ostida ham aniq fikrlay olaman.` |
| 14 | `Notanish odamlar bilan qulay his qilish uchun menga koʻp vaqt kerak.` | Не хватает `oʻzimni`; тяжёлое «чувствовать удобно» | `Notanish odamlar orasida oʻzimni erkin his qilishim uchun koʻproq vaqt kerak.` |
| 16 | `Katta yigʻilishlarga qaraganda kichik kompaniyalarni afzal koʻraman.` | `kompaniyalar` читается как фирмы. Если исходный смысл — небольшой круг людей, это смысловая ошибка | `Koʻpchilik yigʻilgan davralardan koʻra, kichik davralarni afzal koʻraman.` |
| 22 | `Men oʻtkir hissiyotlardan koʻra bashorat qilinish va barqarorlikni afzal koʻraman.` | Неестественное `bashorat qilinish`; буквальный перевод «острых ощущений» | `Kuchli hayajonlardan koʻra, oldindan nima boʻlishi maʼlum boʻlgan barqaror hayotni afzal koʻraman.` |
| 23 | `Koʻp vaqt davomida optimistik va quvnoq kayfiyatdaman.` | «В течение большого времени» вместо обычной частотности | `Koʻpincha kelajakka umid bilan qarayman va kayfiyatim yaxshi boʻladi.` |
| 24 | `Men kamdan-kam chin entuziastlik yoki ilhom his qilaman.` | Неестественная форма `entuziastlik` | `Men kamdan-kam chinakam ishtiyoq yoki ilhom his qilaman.` |
| 26 | `Koʻpchilik odamlar yashirin manfaatlarni koʻzlaydigan koʻrinadi.` | Неловкая грамматическая конструкция | `Menimcha, koʻpchilik odamlar yashirin manfaatlarini koʻzlaydi.` |
| 28 | `Baʼzan ezgulik uchun kichik yolgʻon toʻliq oqlangan.` | Незавершённое оценочное суждение, книжное звучание | `Baʼzan yaxshilik uchun ozgina yolgʻon gapirishni oqlash mumkin, deb hisoblayman.` |
| 34 | `Men odatda olayotganimdan koʻra koʻproq tan olinishga loyiqman.` | Калька с «получаемым признанием» | `Men hozirgidan koʻra koʻproq eʼtirofga loyiqman, deb hisoblayman.` |
| 35 | `Begonaning ogʻrigʻi goʻyo oʻzimnikinday ichimda aks-sado beradi.` | Литературная метафора вместо ясного утверждения | `Boshqa odamning dardini oʻzimnikidek his qilaman.` |
| 36 | `Boshqalarning shikoyatlari meni unchalik qiynaltiravermaydi — har kim oʻz taqdirini oʻzi qurar.` | Пословичный хвост добавляет второе убеждение | Сверить оригинал. Возможная первая часть: `Boshqalarning shikoyatlari meni unchalik tashvishlantirmaydi.` Не удалять вторую часть без проверки методики |
| 43 | `Men oʻz oldimga ambitsiyali maqsadlar qoʻyaman va ularga erishish uchun harakat qilaman.` | `ambitsiyali` усложняет восприятие для широкой аудитории | `Men oʻz oldimga katta maqsadlar qoʻyaman va ularga erishish uchun harakat qilaman.` |
| 44 | `Menga ishni qabul qilinadigan darajada bajarish yetarli — perfektsionizm meni oʻziga tortmaydi.` | Два тяжёлых заимствованных/канцелярских понятия | `Men uchun ishni yetarlicha yaxshi bajarish kifoya — uni mukammal qilishga intilmayman.` |
| 48 | `Koʻpincha oqibatlarni oʻylamasdan impulsiv qarorlar qabul qilaman.` | Термин можно передать обычными словами | `Koʻpincha oqibatlarini oʻylab oʻtirmay, shoshilib qaror qilaman.` |
| 65 | `Odamlarni ishontirish va ularni ortidan ergashtirish.` | Неясно, за кем следовать | `Odamlarni ishontirish va oʻz ortimdan ergashtirish.` Если интересы оформляются без первого лица, унифицировать всю батарею |
| 67 | `Asboblar bilan ishlash, oʻz qoʻlingiz bilan yigʻish yoki tuzatish.` | Не назван объект, лицо отличается от соседних пунктов | `Asboblar bilan ishlash, buyumlarni qoʻlda yigʻish yoki taʼmirlash.` |
| 69 | `Rasm chizish, dizayn qilish, vizual obrazlar yaratish.` | Необязательное усложнение | `Rasm chizish, dizayn qilish va tasvirlar yaratish.` |
| 82 | `Odamlarni qoʻllab-quvvatlash va gʻamxoʻrlik qilish.` | Не хватает управления во второй части | `Odamlarni qoʻllab-quvvatlash va ularga gʻamxoʻrlik qilish.` |
| 90 | `Algoritm boʻyicha aniq, ehtiyotkor ish bajarish.` | `ehtiyotkor` может означать осторожность вместо аккуратности | `Belgilangan tartib boʻyicha ishni aniq va puxta bajarish.` Сверить, действительно ли оригинал про алгоритм |
| 91 | `Koʻp daromad topish va yuqori daromadga ega boʻlish.` | Тавтология | `Yuqori daromadga ega boʻlish.` Убедиться, что исходный пункт не содержал второго признака |
| 99 | `Keskin oʻzgarishlarsiz ishonchli, oldindan aytsa boʻladigan ish.` | `oldindan aytsa boʻladigan ish` звучит неестественно | `Keskin oʻzgarishlar boʻlmaydigan, shartlari oldindan maʼlum barqaror ish.` |
| 108 | `Maʼlumot ovoz chiqarib aytilganda uni quloqdan yaxshi eslab qolaman.` | `quloqdan` — буквальная калька | `Maʼlumotni eshitganimda yaxshiroq eslab qolaman.` |

Для пунктов 9, 22, 23, 36, 44, 48 и 90 особенно важно проверить, не меняют ли упрощения измеряемую черту. Таблица показывает направление исправления, а не разрешение на автоматическую массовую замену.

## 3. Шкалы ответов

Сейчас встречаются `Koʻproq men haqimda emas`, `Koʻproq qiziq emas`, `Koʻproq qiziqarli`, `Koʻproq muhim emas`. Это механическое использование «koʻproq» для русского «скорее». Кроме того, UZ `Neytral` и RU `Нейтрально / затрудняюсь ответить` не полностью одинаковы по смыслу.

Ниже — кандидат на согласованную систему. Применять только после проверки исходных якорей шкал.

| Назначение | Вопрос над шкалой | Пять ответов |
|---|---|---|
| Личность | `Bu fikr sizga qanchalik mos?` | `Umuman mos emas` / `Unchalik mos emas` / `Qisman mos` / `Ancha mos` / `Toʻliq mos` |
| Интересы | `Bu mashgʻulot sizga qanchalik qiziq?` | `Umuman qiziq emas` / `Unchalik qiziq emas` / `Oʻrtacha qiziq` / `Qiziq` / `Juda qiziq` |
| Ценности | `Bu siz uchun qanchalik muhim?` | `Umuman muhim emas` / `Unchalik muhim emas` / `Oʻrtacha muhim` / `Muhim` / `Juda muhim` |

`Qisman mos`, нейтральная позиция и «затрудняюсь» — разные ответы. Если исходная шкала требует нейтрального якоря, выбрать соответствующую формулировку, а не внедрять предложенное `Qisman mos` автоматически. При необходимости вариант «не могу ответить» должен иметь отдельную логику обработки.

Не усиливать один конец шкалы и не смягчать другой. Цифры 1–5 можно сохранить как вспомогательный ориентир, но текст должен оставаться понятным без них.

## 4. Словарь интерфейса

| Контекст / сейчас | Предлагаемый UZ | RU-смысл |
|---|---|---|
| Главное действие `Bepul boshlash` | `Bepul testni boshlash` | Начать бесплатный тест |
| `Portretingiz` как основное название результата | `Natijangiz` | Ваш результат |
| `Portretingizni oling` | `Natijangizni koʻring` | Посмотрите результат |
| `Yoʻlingizni oching` | `Keyingi qadamingizni rejalashtiring` | Спланируйте следующий шаг |
| Кабинет `Akkauntingiz` | `Mening natijalarim` | Мои результаты |
| `Siz kirgan login` | `Foydalanuvchi nomi` | Имя пользователя |
| Поле `Login` | `Foydalanuvchi nomi` | Имя пользователя |
| `Siz kimsiz` | `Natijalaringiz nimani koʻrsatadi?` | Что показывают ваши результаты? |
| `Maqsad qanchalik real` | `Maqsadga erishish uchun nimalar kerak?` | Что нужно для достижения цели? |
| `Yoʻl tanlovlari` | `Reja variantlari` | Варианты плана |
| `Shu yerda va arzon` | `Mahalliy va kam xarajatli variant` | Местный вариант с небольшими затратами |
| `Band odamlar uchun onlayn` | `Moslashuvchan onlayn taʼlim` | Онлайн-обучение с гибким графиком |
| `Xorijda` для удалённой работы | `Xorijiy mijozlar bilan ishlash` | Работа с зарубежными клиентами |
| `Oson yoʻl / Qiyin yoʻl` | `Bosqichma-bosqich / Jadal` | Постепенный / Интенсивный; использовать только при соответствующем содержании |
| `Qanday oʻqish sizga oson` | `Oʻqishni qanday tashkil qilish mumkin?` | Как организовать обучение? |
| `Sizni hayron qoldirishi mumkin boʻlgan yoʻnalishlar` | `Koʻrib chiqishga arziydigan boshqa yoʻnalishlar` | Другие направления, которые стоит рассмотреть |
| `Shu hafta nima qilish kerak` | `Shu hafta boshlang` | Начните на этой неделе |
| `Oʻzingiz va ota-onangiz uchun PDF` | `Yuklab olish va ulashish uchun PDF` | PDF для скачивания и передачи |
| `bir martalik` около цены | `Bir martalik toʻlov` | Разовая оплата |
| `Eng kuchli sunʼiy intellekt yozadi` | `Yoʻnalishlarni solishtirish va batafsil harakat rejasi` | Сравнение направлений и подробный план |
| `Qulf ostidagi boʻlimlar: 28` | Удалить; вместо этого `Batafsil rejada nimalar bor?` | Что входит в подробный план? |

Слова `hisobot`, `natija`, `reja` не взаимозаменяемы:

- `Natija` — результат теста.
- `Hisobot` — полный документ с объяснениями.
- `Reja` — последовательность действий внутри отчёта.
- `Yoʻnalish` — профессиональное или образовательное направление.
- `Kasb` — конкретная профессия.
- `Maqsad` — сформулированная цель человека.

Не называть направление «целью» в одном месте и «профессией» в другом, если это меняет смысл обещания.

## 5. Готовые тексты основных экранов

### Главная

**Заголовок**

Oʻzingizga mos kasbni toping. Birinchi qadamni biling.

**Описание**

Qiziqishlaringiz va kuchli tomonlaringizni yaxshiroq tushuning. Testdan soʻng sizga mos yoʻnalishlarni bepul koʻring. Batafsil oʻqish va ish rejasini esa alohida olishingiz mumkin.

**Кнопки**

Bepul testni boshlash

Natija namunasini koʻrish

**Подпись**

110 ta test savoli va qisqa anketa. Natijaning asosiy qismi bepul.

**Как это работает — три шага**

1. **Savollarga javob bering.** Qiziqishlaringiz, odatlaringiz va siz uchun muhim jihatlarni bilib olamiz.
2. **Natijangizni koʻring.** Kuchli tomonlaringiz va koʻrib chiqishga arziydigan yoʻnalishlar bilan tanishing.
3. **Keyingi qadamni tanlang.** Batafsil reja kerak boʻlsa, oʻqish va ishga kirish yoʻllarini toʻliq hisobotda koʻring.

### Начало

**Заголовок**

Qaysi bosqichdasiz?

**Вариант 1**

Kasbimni hali tanlamadim

Qiziqishlarimga mos yoʻnalishlarni topmoqchiman.

**Вариант 2**

Maqsadim bor

Unga erishish uchun nimalarni oʻrganishimni bilmoqchiman.

### Подготовка

**Заголовок**

Boshlashdan oldin

**Текст**

Test 4 boʻlimdan iborat. Undan keyin imkoniyatlaringiz va rejalaringiz haqida qisqa anketa boʻladi.

Bu yerda toʻgʻri yoki notoʻgʻri javob yoʻq. Hozir sizga eng mos keladigan javobni tanlang.

Javobni tanlaganingizdan soʻng keyingi savol ochiladi. Oldingi javobni oʻzgartirish uchun «Orqaga» tugmasidan foydalaning.

**Кнопка**

Testni boshlash

**Сохранение**

Добавить правдивую подпись согласно фактическому механизму. Не вставлять универсальное обещание синхронизации, пока оно не проверено.

### Переход к анкете

**Заголовок**

Test tugadi. Endi rejangizni hayotingizga moslaymiz.

**Текст для проверенной ветки из 12 вопросов**

Vaqtingiz, oʻqish uchun byudjetingiz va tajribangiz haqida 12 ta qisqa savol qoldi. Bu javoblar tavsiyalarni sizning sharoitingizga moslashtirishga yordam beradi.

**Кнопка**

Anketaga oʻtish

Число брать из реальной ветки, не хранить строкой «12» для всех сценариев.

### Генерация

**Заголовок**

Natijangiz tayyorlanmoqda

**Описание**

Javoblaringiz asosida mos yoʻnalishlar va tavsiyalarni tayyorlayapmiz.

**Долгое ожидание**

Bu odatdagidan biroz koʻproq vaqt olyapti. Natija tayyor boʻlishi bilan shu yerda koʻrsatiladi.

**Ошибка**

Natijani tayyorlashda xatolik yuz berdi. Qayta urinib koʻring.

**Кнопка**

Qayta urinish

Текст о сохранённых ответах и возможности закрыть страницу добавлять только при подтверждённой поддержке.

### Бесплатный результат

**Заголовок**

Natijangiz tayyor

**Вводная фраза**

Javoblaringiz quyidagi yoʻnalishlarni koʻrib chiqishga asos beradi. Ularni kichik amaliy vazifalar orqali sinab koʻring.

**Названия разделов**

- Kuchli tomonlaringiz
- Sizga mos boʻlishi mumkin boʻlgan yoʻnalishlar
- Nimadan boshlash mumkin?
- Batafsil rejada nimalar bor?

**Платный блок**

Keyingi qadamingizni rejalashtiring

Yoʻnalishlarni solishtiring, oʻrganish rejasini koʻring va nimadan boshlashni biling.

Batafsil reja — 79 000 soʻm

Bir martalik toʻlov. Obuna yoʻq.

Сумма, пакет и состав должны подставляться из выбранного предложения.

### Checkout

**Заголовок**

Sizga kerakli rejani tanlang

**Выбор языка**

Hisobot tili

Oʻzbekcha / Русский

Hisobotingiz tanlangan tilda tayyorlanadi.

**Сумма и действие**

Jami: 79 000 soʻm

79 000 soʻm toʻlash

**Условия**

Bir martalik toʻlov. Hisobot tayyor boʻlgach, uni «Mening natijalarim» boʻlimida ochishingiz va PDF shaklida yuklab olishingiz mumkin.

Если доступ не сохраняется именно так, сначала изменить механику или скорректировать текст. Условия возврата и данные продавца не придумывать — получить фактическую политику владельца.

### Кабинет

Mening natijalarim

Davom ettirish

Hisobotni ochish

PDF yuklab olish

Yangi testdan oʻtish

Sozlamalar

Для незавершённого теста: `110 ta savoldan {answered} tasiga javob berdingiz.` Счётчик рассчитывать по реально сохранённым ответам.

## 6. FAQ — новые ответы

### Test bepulmi?

Ha. Testdan oʻtish va asosiy natijani koʻrish bepul. Batafsil oʻqish va ish rejasi kiritilgan toʻliq hisobotni xohlasangiz alohida sotib olasiz.

### Toʻliq hisobotda nimalar boʻladi?

Tanlangan hisobotga qarab, yoʻnalishlarni solishtirish, kerakli koʻnikmalar, oʻqish bosqichlari va ishga kirish uchun birinchi qadamlar beriladi. Xarajat va muddatlar taxminiy boʻlib, imkoniyatlaringizga qarab farq qiladi.

После утверждения состава пакетов уточнить ответ конкретными обещаниями; не оставлять его единственным объяснением тарифов.

### Natija men uchun yakuniy qarormi?

Yoʻq. Natija javoblaringizga asoslangan tavsiya. U kasb tanlashda yordam beradi, lekin qarorni siz qabul qilasiz. Qiziqqan yoʻnalishingizni kichik amaliy vazifa yoki mutaxassis bilan suhbat orqali tekshirib koʻrish foydali.

### Qanday maʼlumotlar soʻraladi?

Test javoblari hamda tavsiyalarni moslashtirish uchun yoshingiz, oʻqishga ajrata oladigan vaqt va byudjetingiz kabi maʼlumotlar soʻraladi. Qaysi maʼlumot qanday ishlatilishi maxfiylik siyosatida tushuntiriladi.

Этот ответ публиковать вместе с реальной политикой. Отдельно подтвердить, какие данные отправляются провайдеру ИИ, где сохраняются и как удаляются. Не утверждать, что такие сведения уже раскрыты в текущей заглушке.

### Javob berishni keyinroq davom ettirsam boʻladimi?

Предлагаемый ответ при подтверждённом сохранении на том же устройстве: `Ha. Saqlangan javoblarga shu qurilmada qaytib, toʻxtagan joyingizdan davom ettirishingiz mumkin.` Для авторизованного межустройственного сохранения нужен отдельный проверенный текст.

### Hisobot tilini tanlasam boʻladimi?

После внедрения выбора: `Ha. Toʻlovdan oldin hisobot tilini tanlaysiz: oʻzbekcha yoki ruscha.` Не обещать автоматический перевод старого отчёта, если функция отсутствует.

## 7. Переписывание сгенерированных рекомендаций

### Пример: категоричный вывод о личности

Сейчас: `Masʼuliyatlilik oʻrtachadan past boʻlgani uchun mustaqil oʻrganishda toʻxtab qolish xavfi bor…`

Предлагаемая подача:

> Oʻqish uchun aniq jadval va kichik muddatlar belgilab koʻring. Haftalik vazifa va ustozning fikr-mulohazasi rejani davom ettirishga yordam berishi mumkin. Ikki haftadan keyin bu tartib sizga qanchalik qulayligini baholang.

Утверждение о конкретной норме оставить только при наличии соответствующих данных и объяснения шкалы.

### Пример: предпочтение слушать превращено в способность

Сейчас: `Siz tinglab va oʻqib eng yaxshi oʻrganasiz, qilib koʻrish va koʻp takrorlash esa sizda kuchsizroq.`

Предлагаемая подача:

> Javoblaringizda tinglash va oʻqishga koʻproq qiziqish bildirgansiz. Yangi mavzuni qisqa tushuntirishdan boshlang, keyin uni amalda sinab koʻring. Qaysi usulda yaxshiroq eslab qolishingizni kichik vazifa orqali tekshiring.

Не заявлять, что анкета измерила слабые практические способности.

### Пример: трудное объяснение типологии

Сейчас: `Siz uch xil kuchni oʻzida jamlagan odamsiz… Odamlarga yaqin tomoningiz bor.`

Предлагаемая подача:

> Javoblaringizda uchta qiziqish ajralib turadi: ijod qilish, ishni tartibga solish va odamlarga yordam berish. Shu sababli, foydalanuvchilar uchun qulay yechim yaratishga qaratilgan vazifalarni sinab koʻrishingiz mumkin.

Сохранять конкретные три интереса только если они действительно следуют из данного профиля.

### Пример: название маршрута

Сейчас: `Onlayn, band odamlar uchun: haftasiga 4–5 soat bilan interfeys dizayni yoki sayt yigʻish (yengil yoʻl)`

Предлагаемая карточка:

**Onlayn oʻqish va dastlabki portfolio**

- Haftalik vaqt: 4–5 soat.
- Format: mustaqil mashqlar va ustoz bilan maslahat.
- Birinchi natija: bitta kichik loyiha.
- Muddat va xarajat: faqat tekshirilgan maʼlumot yoki aniq belgilangan taxmin.

Числа в этом примере отражают обсуждавшийся сценарий, а не универсальную рекомендацию. Для реального пользователя генерировать из его вводных.

## 8. Орфография, термины и форматирование

- Утвердить единые апострофы в интерфейсных строках: `oʻ`, `gʻ`, `maʼlumot`, `taʼlim`. Проверить отображение, поиск, копирование и PDF. В этом приложении отдельные типографические варианты при переносе из черновиков нормализовать перед внедрением.
- Денежные суммы: `29 000 soʻm`, `79 000 soʻm`; валюта не отрывается от суммы. `Bir martalik toʻlov` — отдельная строка, а не слитный текст.
- Диапазоны: `5–10 soat`, `12–18 oy`; единица понятна и указана один раз.
- Даты в UI оформлять последовательно: например `26-sentabr, 2026`. Дата проверки источника и дата создания отчёта — разные поля.
- Различать `kasb`, `yoʻnalish`, `maqsad`, `reja`. Не заменять всё словом `yoʻl`.
- Не чередовать `portfolio` и `portfel` для работ специалиста без редакционной причины. Выбрать `portfolio`, при первом упоминании: `bajargan ishlaringiz toʻplami`.
- `QA` при первом упоминании раскрыть: `dasturiy taʼminotni sinovdan oʻtkazish (QA)`.
- `UI/UX` раскрыть: `sayt va ilovalar interfeysi hamda ulardan foydalanish qulayligi` — в объяснении, не в каждом коротком названии.
- Не переводить `company` механически как организацию, `route` всегда как маршрут транспорта, `learning preference` как измеренную способность.
- В тестах не смешивать `men`, `siz`, `oʻzi` внутри одного утверждения. В отчёте использовать `siz`.
- Не писать каждый значимый термин с прописной буквы: `Ijodkor`, `Tartibparvar`, `Odamlarga yaqin` внутри обычного предложения утяжеляют текст.
- Не заменять психологический термин бытовым, если замена меняет конструкт; сначала дать корректное простое объяснение.

## 9. Требования к текстам, которые генерирует ИИ

1. Писать на языке заказа; не смешивать RU и UZ внутри разделов.
2. Использовать согласованный словарь и обычные короткие предложения.
3. Делать один вывод на абзац; действия выводить отдельными пунктами.
4. Для каждой рекомендации указывать основание в данных и способ попробовать направление.
5. Не делать неподтверждённых выводов о таланте, интеллекте, психическом здоровье или неспособности освоить профессию.
6. Не превращать любую комбинацию в «редкую» или «уникальную».
7. Не выводить фактические цены, ссылки, проходные баллы, вакансии и наличие курсов из воображения модели.
8. Не заполнять свободный текст пользователя как инструкцию для генератора; это данные анкеты.
9. Проверять внутренние повторы и согласованность времён, бюджета, языка, нагрузки и цели.
10. Сохранять версию шаблона и текста результата. Изменение промпта не должно молча переписывать купленные документы.

## 10. Приёмка локализации

- [ ] Все замечания по номерам сопоставлены со стабильными ID вопросов.
- [ ] Исправления вопросов сверены с оригиналом, отрицаниями и направлением ключа.
- [ ] RU и UZ якоря шкал имеют одинаковый смысл.
- [ ] Редактор-носитель проверил вопросы, кнопки, ошибки, отчёты и PDF.
- [ ] Пользователи целевых возрастов могут пересказать трудные вопросы своими словами.
- [ ] Узбекские и русские длинные строки помещаются на 360 px без скрытия смысла.
- [ ] Все динамические числа и цены берутся из данных, а не дублируются в переводах.
- [ ] Полный отчёт и PDF соответствуют сохранённому языку заказа.
- [ ] Публичные обещания о данных и сохранении соответствуют проверенной реализации.
