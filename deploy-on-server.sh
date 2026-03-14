#!/bin/bash
# Запускать на сервере в папке проекта: bash deploy-on-server.sh
# Обновляет код, пересобирает и перезапускает spindate.

set -e
echo "=== Очистка старой сборки ==="
rm -rf .next
echo "=== Установка зависимостей ==="
npm ci
echo "=== Сборка ==="
npm run build
echo "=== Перезапуск PM2 ==="
pm2 restart spindate
echo "=== Готово. Проверь https://spindate.lemnity.ru ==="
