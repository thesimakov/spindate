#!/bin/bash
# Запускать на сервере в папке проекта: bash deploy-on-server.sh
# Обновляет код, пересобирает и перезапускает spindate.

set -e
echo "=== Остановка PM2 (иначе npm ci может дать ENOTEMPTY в node_modules) ==="
pm2 stop spindate 2>/dev/null || true
sleep 2
echo "=== Очистка старой сборки ==="
rm -rf .next node_modules
echo "=== Установка зависимостей ==="
npm ci
echo "=== Сборка ==="
npm run build
echo "=== Перезапуск PM2 ==="
pm2 restart spindate
echo "=== Готово. Проверь свой домен или http://IP:3000 ==="
