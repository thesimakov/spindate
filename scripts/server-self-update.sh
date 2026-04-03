#!/usr/bin/env bash
# Автообновление на VPS: git pull → npm ci → build → pm2 reload (graceful, zero-downtime).
# Пример crontab (каждые 5 минут, только если есть новые коммиты):
#   */5 * * * * /usr/bin/env bash /var/www/spindate/scripts/server-self-update.sh >> /var/log/spindate-update.log 2>&1
#
# Переменные окружения (опционально):
#   SPINDATE_DIR — каталог репозитория (по умолчанию каталог выше scripts/)
#   PM2_APP      — имя процесса PM2 (по умолчанию spindate)

set -euo pipefail

ROOT="${SPINDATE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PM2_NAME="${PM2_APP:-spindate}"
LOCK="/tmp/spindate-self-update.lock"

cd "$ROOT"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Iseconds) skip: another update running"
  exit 0
fi

git fetch origin --quiet || { echo "$(date -Iseconds) git fetch failed"; exit 1; }
UPSTREAM="${UPSTREAM_BRANCH:-main}"
if ! git rev-parse "origin/$UPSTREAM" >/dev/null 2>&1; then
  echo "$(date -Iseconds) no origin/$UPSTREAM"
  exit 1
fi
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$UPSTREAM")
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date -Iseconds) updating $LOCAL → $REMOTE"
git checkout -- next-env.d.ts 2>/dev/null || true
git merge --ff-only "origin/$UPSTREAM"

export NODE_ENV=production
npm ci --production
npm run build

# Graceful restart: старый процесс обслуживает запросы пока новый не стартует.
# Данные в Redis и SQLite не теряются.
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save

echo "$(date -Iseconds) done — now at $(git rev-parse --short HEAD)"
