# Горизонтальное масштабирование Spindate

Краткая карта: CDN / балансировщик → **API (Next.js, REST)** и **Realtime (WebSocket, `custom-server`)** → **Redis** (состояние столов, кеш, rate-limit, Pub/Sub комнат, BullMQ) → **SQLite** (сейчас) / **PostgreSQL** (целевая БД).

## Обязательные переменные при нескольких API-инстансах

```bash
REDIS_URL=redis://:password@host:6379/0
```

Без `REDIS_URL` состояние столов и кеш профилей деградируют до in-memory на каждом процессе — см. [REDIS_MULTI_INSTANCE.md](./REDIS_MULTI_INSTANCE.md).

## Балансировка и SSL

- **Cloudflare** (или аналог) перед origin: SSL, WAF, rate limit по IP.
- **NGINX** на сервере: `proxy_pass` на Next и/или отдельный upstream для WebSocket — см. [nginx-scale-example.conf](./nginx-scale-example.conf).
- Для WebSocket при нескольких realtime-процессах: **sticky** (cookie / hash) **или** Redis Pub/Sub для комнат (`lib/ws-room-redis.ts`).

## Разделение процессов

| Процесс | Назначение |
|---------|------------|
| `next start` / PM2 | HTTP, API routes, SSR |
| `npm run start:ws` / `USE_CUSTOM_SERVER=1` | Next + `/ws/rooms` на одном порту (dev/self-host) |
| `npm run worker` | BullMQ: награды, миссии, аналитика |

## Realtime и шардирование

- `GET /api/realtime/config` — `wsUrl`, `shardId`, диапазон `tableId` для маршрутизации клиента.
- Переменные: `NEXT_PUBLIC_REALTIME_WS_URL`, `REALTIME_SHARD_ID`, `REALTIME_TABLE_ID_MIN`, `REALTIME_TABLE_ID_MAX`.

## Фоновые задачи

- [BullMQ](https://docs.bullmq.io/) — очередь `spindate-background`, соединение через `REDIS_URL`.
- Код: `lib/jobs/`, запуск: `npm run worker`.

## Миграция на PostgreSQL

- [POSTGRES_MIGRATION.md](./POSTGRES_MIGRATION.md)
