# Развёртывание на обычном сервере (этап 10Б)

Эта инструкция — для программиста/сисадмина, которого владелец нанимает для переезда сайта с
Vercel на обычный сервер (например, в Узбекистане — из-за закона о локализации персональных
данных). Написана простым языком, шаг за шагом. Проект переносимый: не использует ничего, что
работает только на Vercel.

Два способа запустить сайт на сервере:

- **Способ 1 (проще): Docker.** Одна команда поднимает и сайт, и базу данных. Рекомендуется.
- **Способ 2: без Docker.** Node.js и PostgreSQL ставятся на сервер напрямую. Нужен, если на
  сервере уже стоит своя база данных или Docker нельзя использовать.

Оба способа заканчиваются одним и тем же: сайтом на порту 3000, перед которым стоит nginx с HTTPS.

---

## Что нужно перед началом

- Свой сервер (VPS) с Ubuntu 22.04 или новее. Для старта достаточно 2 ГБ памяти.
- Доменное имя (например `yourway.uz`), уже направленное на IP-адрес сервера (A-запись у
  регистратора домена).
- Доступ по SSH к серверу.
- Заполненный файл переменных окружения — скопировать `.env.example` в `.env` и вписать значения
  (ключ Claude API, `SUPERADMIN_LOGINS`, и т. д. — комментарии в файле объясняют каждую переменную
  по-русски). **Обязательно** поменять `APP_URL` на настоящий адрес сайта (`https://yourway.uz`).

---

## Способ 1: Docker

1. Установить Docker и Docker Compose (если ещё не установлены):

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. Скопировать код проекта на сервер (`git clone` или `git pull`, если репозиторий уже там).

3. В папке проекта:

   ```bash
   cp .env.example .env
   nano .env   # вписать значения, особенно APP_URL, ANTHROPIC_API_KEY, SUPERADMIN_LOGINS
   ```

   В `.env` для Docker **не нужно** менять `DATABASE_URL` — `docker-compose.yml` сам подставляет
   правильный адрес базы (контейнер с Postgres называется `db`).

4. Запустить:

   ```bash
   docker compose up -d --build
   ```

   Это поднимет два контейнера: `db` (PostgreSQL) и `app` (сам сайт). При первом запуске `app`
   сам применит миграции базы (создаст все таблицы) — ждать отдельно не нужно.

5. Проверить, что сайт работает:

   ```bash
   curl http://localhost:3000/api/health
   ```

   Должно быть `{"ok":true,"db":"ok"}`.

6. Дальше — настроить nginx и HTTPS (раздел ниже), они одинаковы для обоих способов.

Обновление сайта после изменений в коде (`git pull`), затем:

```bash
docker compose up -d --build
```

Старый контейнер `app` заменится новым, база данных (том `db_data`) не тронется.

---

## Способ 2: без Docker (Node.js + PostgreSQL напрямую)

1. Установить Node.js 22:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Установить PostgreSQL:

   ```bash
   sudo apt-get install -y postgresql
   sudo -u postgres createuser yourway --pwprompt
   sudo -u postgres createdb yourway --owner=yourway
   ```

3. Скопировать код проекта на сервер, затем:

   ```bash
   cp .env.example .env
   nano .env
   # DATABASE_URL="postgresql://yourway:<пароль>@localhost:5432/yourway"
   # APP_URL="https://yourway.uz"
   # + остальные переменные
   npm install
   npm run db:deploy     # применить миграции — создать таблицы
   npm run build
   ```

4. Запустить сайт как постоянный процесс — проще всего через `systemd`. Создать файл
   `/etc/systemd/system/yourway.service`:

   ```ini
   [Unit]
   Description=yourway.uz
   After=network.target postgresql.service

   [Service]
   Type=simple
   WorkingDirectory=/path/to/yourway.uz
   EnvironmentFile=/path/to/yourway.uz/.env
   ExecStart=/usr/bin/npm start
   Restart=always
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```

   Затем:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now yourway
   sudo systemctl status yourway   # проверить, что запустился
   ```

5. Проверка: `curl http://localhost:3000/api/health`.

Обновление после `git pull`:

```bash
npm install
npm run db:deploy
npm run build
sudo systemctl restart yourway
```

---

## nginx и HTTPS (общее для обоих способов)

Сайт слушает `http://localhost:3000`. Снаружи его должен показывать nginx — он обслуживает HTTPS
и проксирует запросы на порт 3000.

1. Установить nginx и certbot (бесплатные сертификаты Let's Encrypt):

   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```

2. Создать `/etc/nginx/sites-available/yourway`:

   ```nginx
   server {
       listen 80;
       server_name yourway.uz www.yourway.uz;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Заголовок `X-Forwarded-For` важен: по нему сайт узнаёт настоящий IP-адрес посетителя (для
   лимитов на вход и на тизер, см. CLAUDE.md §6, §7).

3. Включить сайт и получить сертификат:

   ```bash
   sudo ln -s /etc/nginx/sites-available/yourway /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d yourway.uz -d www.yourway.uz
   ```

   Certbot сам допишет в конфиг nginx редирект на HTTPS и настроит автопродление сертификата.

4. Проверить в браузере: `https://yourway.uz` должен открыться с замком.

---

## Миграции базы данных

Миграция — это изменение структуры базы (новая таблица или поле). Когда программист меняет
`prisma/schema.prisma`, вместе с этим появляется папка в `prisma/migrations/`. Применить их на
сервере:

- Docker: происходит автоматически при каждом `docker compose up -d --build`.
- Без Docker: `npm run db:deploy` (шаг 3 выше повторить после `git pull`).

Ничего вручную писать не нужно — команда сама поймёт, какие миграции ещё не применены.

---

## Резервные копии базы данных

Самое важное на сервере — база данных (в ней все аккаунты, отчёты, платежи). Её нужно бэкапить
каждый день.

**Docker:**

```bash
docker compose exec -T db pg_dump -U yourway yourway | gzip > /backups/yourway-$(date +%F).sql.gz
```

**Без Docker:**

```bash
pg_dump -U yourway yourway | gzip > /backups/yourway-$(date +%F).sql.gz
```

Добавить эту команду в `crontab` (например, каждую ночь в 3:00):

```
0 3 * * * /path/to/backup-script.sh
```

Хранить копии не только на этом же сервере (если сервер сломается, копия должна быть в другом
месте — например, скачиваться на другой сервер или в облачное хранилище).

**Восстановление из копии** (если что-то случилось с базой):

```bash
gunzip -c /backups/yourway-2026-09-01.sql.gz | docker compose exec -T db psql -U yourway yourway
```

(без Docker — то же самое, но `psql -U yourway yourway` напрямую).

---

## Хранение PDF-отчётов

PDF-файлы не хранятся на диске: каждый раз собираются заново при скачивании (см.
`src/app/api/report/[id]/pdf/route.ts`). Отдельное хранилище файлов (диск, S3) для этого не нужно —
значит, и переносить при смене сервера ничего, кроме базы данных, не нужно.

---

## Чек-лист после переезда

- [ ] `https://yourway.uz` открывается с замком (сертификат от Let's Encrypt).
- [ ] `/api/health` отвечает `{"ok":true,"db":"ok"}`.
- [ ] Можно пройти тесты, получить тизер, зарегистрироваться, оплатить тестовым провайдером,
      скачать PDF (вся воронка целиком — как при обычной проверке этапа).
- [ ] `/admin` открывается под суперадмином (см. `SUPERADMIN_LOGINS` в `.env`).
- [ ] Настроен ежедневный бэкап базы данных, и хотя бы раз проверено восстановление из копии.
- [ ] Старый адрес на Vercel отключён или сделан редирект на новый сервер.
