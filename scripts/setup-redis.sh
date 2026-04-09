#!/usr/bin/env bash
set -euo pipefail

# =============================================================
# Крути и знакомься!: Установка и настройка Redis на Ubuntu VPS
# Запуск: bash scripts/setup-redis.sh
# Должен выполняться от root на сервере.
# =============================================================

APP_DIR="/var/www/spindate"
ENV_FILE="$APP_DIR/.env.local"
REDIS_CONF="/etc/redis/redis.conf"

echo "=== 1/5  Установка Redis ==="
apt-get update -qq
apt-get install -y redis-server

echo "=== 2/5  Настройка Redis ==="
# bind только на localhost
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"
# supervised через systemd
sed -i 's/^supervised .*/supervised systemd/' "$REDIS_CONF"
# Если строки supervised нет — добавить
grep -q '^supervised' "$REDIS_CONF" || echo 'supervised systemd' >> "$REDIS_CONF"
# maxmemory 128mb
grep -q '^maxmemory ' "$REDIS_CONF" && sed -i 's/^maxmemory .*/maxmemory 128mb/' "$REDIS_CONF" || echo 'maxmemory 128mb' >> "$REDIS_CONF"
# maxmemory-policy
grep -q '^maxmemory-policy ' "$REDIS_CONF" && sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF" || echo 'maxmemory-policy allkeys-lru' >> "$REDIS_CONF"

systemctl restart redis-server
systemctl enable redis-server

echo "=== 3/5  Проверка Redis ==="
PONG=$(redis-cli ping)
if [ "$PONG" != "PONG" ]; then
  echo "ОШИБКА: Redis не отвечает (ожидался PONG, получен: $PONG)"
  exit 1
fi
echo "Redis работает: $PONG"

echo "=== 4/5  Добавление REDIS_URL в .env.local ==="
if [ ! -f "$ENV_FILE" ]; then
  echo "Файл $ENV_FILE не найден, создаю..."
  touch "$ENV_FILE"
fi

if grep -q '^REDIS_URL=' "$ENV_FILE"; then
  echo "REDIS_URL уже задан в $ENV_FILE — пропускаю"
else
  echo '' >> "$ENV_FILE"
  echo 'REDIS_URL=redis://127.0.0.1:6379/0' >> "$ENV_FILE"
  echo "Добавлено: REDIS_URL=redis://127.0.0.1:6379/0"
fi

echo "=== 5/5  Перезапуск Крути и знакомься! ==="
cd "$APP_DIR"
if command -v pm2 &>/dev/null; then
  pm2 restart spindate || pm2 start ecosystem.config.cjs --env production
  echo ""
  echo "Последние логи:"
  pm2 logs spindate --lines 10 --nostream
else
  echo "PM2 не найден. Перезапустите приложение вручную."
fi

echo ""
echo "=== Готово! ==="
echo "Проверка ключей (появятся после входа игрока):"
redis-cli keys "spindate:*"
echo ""
echo "Redis успешно подключён к Крути и знакомься!"
