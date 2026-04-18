# Эталонный стек: Spin Game API (Express + Socket.io + PostgreSQL + Redis)

Отдельный сервис от основного приложения `spindate` (там Next.js + `ws`). Здесь — стек из ТЗ: **Node.js, Express, Socket.io, Prisma/PostgreSQL, Redis**.

## Структура папок

```
reference/spin-game-stack/
  prisma/
    schema.prisma      # Модели: User, Room, Gift, Kiss, SecretKiss, Mission, …
    seed.ts
  src/
    index.ts           # HTTP + Socket.io на одном порту
    config/env.ts
    auth/              # сессии в Redis, контракт VK
    db/prisma.ts
    redis/client.ts
    domain/popularity.ts
    http/routes.ts     # REST: auth, профиль, комнаты, подарки, инвайты, matchmaking
    socket/
      events.ts        # имена событий
      handlers.ts      # join_room, spin_bottle, kiss_player, …
    game/spin-loop.ts
    services/          # комнаты, подарки, миссии, секрет, инвайты, matchmaking
  frontend-examples/   # React + socket.io-client + Tailwind
  .env.example
```

## Запуск

1. PostgreSQL и Redis локально.
2. `cp .env.example .env` и выставить `DATABASE_URL`.
3. `npm install`
4. `npx prisma migrate dev --name init`
5. `npx prisma db seed`
6. `npm run dev`

Сервер: `http://localhost:4000`, Socket.io на том же origin (путь по умолчанию `/socket.io`).

## Аутентификация

- `POST /api/auth/vk` с телом `{ vkUserId, username, avatar?, gender?, age? }`.
- При `DEV_VK_BYPASS=true` можно передать `X-VK-User-Id` для подстановки id.
- Ответ: `sessionToken` — передавать в Socket.io `auth: { token }` и в REST `Authorization: Bearer <token>`.

## Масштабирование

- Горизонтально: несколько инстансов Node + **Redis adapter** для Socket.io (`@socket.io/redis-adapter`), общий PostgreSQL, sticky sessions на LB или только WebSocket upgrade на одном маршруте.
- Сессии уже в Redis (`spin:session:*`).
- Matchmaking — очередь `spin:match:global` (LIST); при росте нагрузки заменить на отдельный матчмейкер / отдельные пулы по режимам.

## Связь с основным репозиторием

Продакшен-приложение может остаться на Next + текущем `/ws/rooms`; этот каталог — **контракт и эталонная реализация** для миграции на Socket.io + PG по `docs/POSTGRES_MIGRATION.md`.
