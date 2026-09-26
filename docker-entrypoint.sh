#!/bin/sh
# Перед запуском сайта — применить миграции базы (как npm run db:deploy).
# Если папка миграций пуста, prisma просто ничего не делает.
set -e
npx prisma migrate deploy --schema prisma/schema.prisma
exec "$@"
