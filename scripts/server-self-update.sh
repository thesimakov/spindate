#!/usr/bin/env bash
# Автообновление на VPS без GitHub Actions: git pull → npm ci → build → pm2 restart.
# Пример crontab (каждые 5 минут, только если есть новые коммиты — см. git fetch):
#   */5 * * * * cd /var/www/spindate && /usr/bin/env bash scripts/server-self-update.sh >> /var/log/spindate-update.log 2>&1
#
# Переменные окружения (опционально):
#   SPINDATE_DIR — каталог репозитория (по умолчанию каталог выше scripts/)
#   PM2_APP    — имя процесса PM2 (по умолчанию spindate)

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
  echo "$(date -Iseconds) already at $REMOTE"
  exit 0
fi

echo "$(date -Iseconds) updating $LOCAL → $REMOTE"
# Снять типичную блокировку pull (сгенерённый next-env.d.ts)
git checkout -- next-env.d.ts 2>/dev/null || true
git merge --ff-only "origin/$UPSTREAM"

export NODE_ENV=production
rm -rf node_modules
npm ci
npm run build

pm2 restart "$PM2_NAME" --update-env || pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "$(date -Iseconds) done"
