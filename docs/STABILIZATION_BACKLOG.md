# Backlog стабилизации Spindate

## P0 (критично для мультиплеера)

1. **Redis в production обязателен**  
   Риск: расхождение столов между инстансами при in-memory fallback.  
   Статус: добавлен runtime warning в `lib/redis.ts`.

2. **Единый whitelist sync-экшенов**  
   Риск: клиент и сервер расходятся по разрешенным action и появляется "тихий" рассинхрон.  
   Статус: вынесено в `lib/sync-invariants.ts`, подключено в клиент и сервер.

3. **Валидация sender membership в /api/table/events**  
   Риск: событие от пользователя, которого нет за столом, ломает чат/фазы/лог.  
   Статус: добавлена проверка в `lib/live-table-events-server.ts`.

## P1 (устойчивость игрового цикла и UX)

1. **Анкер таймера хода к серверному `turnStartedAtMs`**  
   Риск: дрейф и рывки таймера после перезахода/фона вкладки.  
   Статус: добавлено поле состояния + использование в `use-game-timers`.

2. **Диагностика отклоненных push-событий**  
   Риск: сложно понять причину "залипания" фазы у пользователей.  
   Статус: API возвращает `reason`, клиент пишет debug-лог `push_rejected`.

3. **Диагностика регрессии revision**  
   Риск: устаревший snapshot может затереть более новый локальный state.  
   Статус: добавлен debug-лог `authority_revision_regression` в sync engine.

## P2 (дальнейшие улучшения)

1. Перенести часть таймеров из `components/game-room.tsx` в специализированные hooks.
2. Добавить отдельный health endpoint по sync-слою (Redis, authority, events lag).
3. Ввести интеграционный сценарий "2 клиента, 1 стол, 3 раунда" как e2e-smoke.

## Тестовый щит (минимум)

- `tests/sync-invariants.test.ts`:  
  - обязательные sync-действия в whitelist;  
  - запрет локальной экономики в sync;  
  - отсутствие дублей.

- Уже существующие:  
  - `tests/table-authority-apply.test.ts`  
  - `tests/spin-timing.test.ts`

Рекомендуемый smoke после деплоя:

1. Два клиента входят в один стол.
2. Игрок A запускает countdown -> spin -> result.
3. Проверить равенство у обоих: `roundNumber`, `currentTurnIndex`, `isSpinning=false`, `showResult` lifecycle.
4. Проверить, что отклоненные события в `/api/table/events` имеют `reason`.
