# Контракт инвариантов синхронизации Spindate

Этот документ фиксирует "что не должно ломаться" в мультиплеере и где это обеспечивается в коде.

## 1) Turn Flow и Authority

- Источник истины по ходу, раунду, фазам: `TableAuthorityPayload`.
- Любое событие стола сначала проходит через `/api/table/events` и `pushTableEvent()`, затем применяется на сервере (`applyAuthorityEvent()`), после чего клиенты догоняются через `/api/table/state`.
- Клиент не должен отправлять локально-экономические события (`PAY_VOICES`, `ADD_VOICES`) в поток синка стола.

Код:
- `lib/sync-invariants.ts`
- `lib/live-table-events-server.ts`
- `lib/table-authority-server.ts`
- `hooks/use-sync-engine.ts`

## 2) Единый whitelist синхронизируемых действий

- Разрешенные типы действий вынесены в единый источник: `TABLE_SYNCED_ACTION_TYPES`.
- И клиент (`use-sync-engine`) и сервер (`live-table-events-server`) используют один и тот же фильтр `isTableSyncedAction()`.

Это исключает рассинхрон вида "клиент отправляет событие, сервер не принимает" из-за дублирующихся switch-блоков.

## 3) Sender integrity (кто имеет право пушить)

- Событие отклоняется, если отправитель не найден в текущем составе стола (`senderInCurrentTable`).
- Для чувствительных действий применяются дополнительные правила:
  - `SET_PAIR_KISS_CHOICE`: свой выбор или round-driver за бота.
  - `FINALIZE_PAIR_KISS`: round-driver либо любой участник после таймаута/двух ответов.
  - turn lifecycle (`START_COUNTDOWN`, `START_SPIN`, `STOP_SPIN`, `NEXT_TURN`): активный игрок или round-driver.

Код:
- `lib/live-table-events-server.ts`
- `app/api/table/events/route.ts` (возвращает `reason` при отклонении)

## 4) Multi-instance guardrail

- Если Redis недоступен в production, процесс пишет одноразовый warning:
  - fallback в in-memory допустим только как аварийный режим;
  - в multi-instance это приводит к расхождению столов.

Код:
- `lib/redis.ts`

## 5) Критичные проверки перед релизом

- В production обязательно настроен `REDIS_URL`.
- Для `POST /api/table/events` отклоненные события содержат `reason` (для диагностики).
- Для каждого нового синхронизируемого action обновляется только `lib/sync-invariants.ts` и тесты.
