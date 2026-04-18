# Развёртывание на сервере (VPS)

Краткий чеклист. Подробная инструкция с нуля — [docs/DEPLOY_FROM_SCRATCH.md](./docs/DEPLOY_FROM_SCRATCH.md). Деплой с GitHub по SSH — [docs/GITHUB_DEPLOY_SECRETS.md](./docs/GITHUB_DEPLOY_SECRETS.md).

## 1. Требования

- Node.js 20+
- Папка **public/** (в т.ч. **public/assets/** с картинками) должна быть на сервере
- При **нескольких инстансах** Next/API: общий **Redis** — `REDIS_URL` в окружении (см. [docs/REDIS_MULTI_INSTANCE.md](./docs/REDIS_MULTI_INSTANCE.md), [docs/SCALING.md](./docs/SCALING.md))

## 2. Установка и первый запуск

```bash
cd /var/www/spindate
echo 'NEXT_PUBLIC_APP_URL=https://ваш-домен.ru' >> .env.local
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Выполнить команду, которую выведет pm2 startup
```

Приложение слушает порт из **`ecosystem.config.cjs`** (по умолчанию **3002**, на одном VPS с другим Next — **rps-vk-game** обычно **3001**). Проверка: `http://IP:3002`. Nginx должен проксировать на **тот же** порт.

## 3. Nginx и HTTPS

Пример конфига: [docs/DEPLOY_FROM_SCRATCH.md](./docs/DEPLOY_FROM_SCRATCH.md#8-nginx-как-обратный-прокси). Перепривязка домена к новому серверу: [docs/DOMAIN_NEW_SERVER.md](./docs/DOMAIN_NEW_SERVER.md).

Масштабирование (несколько upstream, SSL, `limit_req`, sticky для WebSocket): [docs/SCALING.md](./docs/SCALING.md), фрагмент [docs/nginx-scale-example.conf](./docs/nginx-scale-example.conf).

## 4. Картинки (бутылочки, рамки, эмоции)

Все файлы в **public/assets/**. Next.js отдаёт их по `/assets/...`. Убедись, что при деплое папка **public** копируется на сервер (при деплое через GitHub Actions это делается автоматически).

Проверка с сервера:

```bash
curl -sI http://127.0.0.1:3002/assets/b_standart_v2.webp | head -1
# ожидается: HTTP/1.1 200 OK
```

Описание каталога ассетов: [public/assets/README.md](./public/assets/README.md).

## 5. Обновление после изменений

Вручную:

```bash
cd /var/www/spindate
git pull
rm -rf .next
npm ci
npm run build
pm2 restart spindate
```

Или используй деплой с GitHub (настрой секреты по [docs/GITHUB_DEPLOY_SECRETS.md](./docs/GITHUB_DEPLOY_SECRETS.md)) — после push в `main` сборка и выкладка на сервер выполняются автоматически.

## 6. Эталонный API spin-game (PostgreSQL, `reference/spin-game-stack`)

Это **отдельный** сервис (Express + Prisma), не основной Next.js. Папка **`reference/spin-game-stack`** должна быть в репозитории; если на сервере её нет — сделай **`git pull`** с ветки, где она уже закоммичена (или скопируй каталог с машины разработчика).

Из **корня** репозитория:

```bash
npm run spin-game:install
cp reference/spin-game-stack/.env.example reference/spin-game-stack/.env
# задать DATABASE_URL в reference/spin-game-stack/.env
npm run spin-game:migrate
npm run spin-game:seed
```

Первая миграция уже с именем `init` в скрипте `db:migrate:init`. Основное приложение spindate по умолчанию использует **SQLite**; Prisma здесь только для этого эталонного стека.
