# Обычный образ для любого сервера с Docker (не только Vercel — см. docs/deploy-server.md).
# Сборка в два шага: сначала ставим зависимости и собираем сайт, потом кладём в маленький
# финальный образ только то, что нужно для запуска ("standalone", см. next.config.ts).

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# DATABASE_URL на этом шаге не нужен: prisma generate не подключается к базе, а миграции
# применяются отдельно, при запуске контейнера (см. docker-entrypoint.sh).
RUN npx prisma generate
RUN npm run build


FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production

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
