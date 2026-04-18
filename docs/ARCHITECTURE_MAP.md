# Архитектурная карта Spindate (стол и синк)

## Основные контуры

- **UI/клиент:** `components/*`, `hooks/*`, `lib/game-context.tsx`
- **Sync API:** `app/api/table/live/route.ts`, `app/api/table/state/route.ts`, `app/api/table/events/route.ts`
- **Authority ядро:** `lib/table-authority-server.ts`, `lib/table-authority-apply.ts`, `lib/table-authority-merge.ts`
- **Live presence/events:** `lib/live-tables-server.ts`, `lib/live-table-events-server.ts`
- **Infra:** `lib/redis.ts`, `lib/redis-rmw.ts`

## Поток данных

```mermaid
flowchart LR
  ClientA[ClientA useSyncEngine] -->|join/sync| LiveApi[/api/table/live]
  ClientB[ClientB useSyncEngine] -->|join/sync| LiveApi
  LiveApi --> LiveStore[Live tables store]
  ClientA -->|push action| EventsApi[/api/table/events]
  ClientB -->|pull events| EventsApi
  EventsApi --> Authority[table-authority-server]
  Authority --> Redis[(Redis)]
  ClientA -->|poll state| StateApi[/api/table/state]
  ClientB -->|poll state| StateApi
  StateApi --> Authority
  Authority --> Snapshot[TableAuthorityPayload revision]
  Snapshot --> ClientA
  Snapshot --> ClientB
```

## Критичные инварианты

1. `TableAuthorityPayload` — единственный источник истины по ходу/фазам/раунду.
2. Синк-экшены проходят через единый whitelist (`lib/sync-invariants.ts`).
3. Экономика пользователя не уходит в синк стола (`PAY_VOICES`, `ADD_VOICES` локальны).
4. В `POST /api/table/events` sender должен быть участником текущего стола.
5. В production без Redis допускается только аварийный режим (warning обязателен).
