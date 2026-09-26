# Обычный образ для любого сервера с Docker (не только Vercel — см. docs/deploy-server.md).
# Сборка в два шага: сначала ставим зависимости и собираем сайт, потом кладём в маленький
# финальный образ только то, что нужно для запуска ("standalone", см. next.config.ts).

FROM node:22-slim AS build
WORKDIR /app

# openssl — без него Prisma не находит libssl на этом образе (predупреждение "failed to detect
# the libssl/openssl version") и генерация клиента может неожиданно сломаться.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# prisma/schema.prisma нужен уже здесь: `npm ci` сам запускает `prisma generate` (postinstall),
# а он ищет схему по стандартному пути — значит, до `npm ci` схема должна быть скопирована.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# В проекте нет папки public (нет статических файлов вроде favicon) — next build её не создаёт,
# а следующий шаг (COPY --from=build .../public) требует, чтобы источник существовал.
RUN mkdir -p public
# DATABASE_URL на этом шаге не нужен: prisma generate не подключается к базе, а миграции
# применяются отдельно, при запуске контейнера (см. docker-entrypoint.sh).
RUN npx prisma generate
RUN npm run build


FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
# Полный node_modules из шага сборки — нужен для `npx prisma migrate deploy` при старте контейнера
# (docker-entrypoint.sh). "standalone" от Next.js уже принёс свою копию нужных пакетов рядом
# с server.js, эта — только для команды prisma при запуске.
COPY --from=build /app/node_modules ./node_modules
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chown -R nextjs:nextjs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
