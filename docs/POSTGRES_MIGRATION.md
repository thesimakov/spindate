# Миграция SQLite → PostgreSQL

Цель: горизонтальное масштабирование API с **несколькими писателями** и управляемыми миграциями. Сейчас данные в `better-sqlite3` ([`lib/db.ts`](../lib/db.ts)), файл под `SPINDATE_DATA_DIR`.

## Принципы

1. **Схема 1:1** с SQLite: типы PostgreSQL: `TEXT` → `TEXT`/`UUID`, `INTEGER` → `BIGINT`/`INTEGER`, JSON в `TEXT` → `JSONB` (по желанию).
2. **Первичные ключи**: строковые `users.id` оставить как `TEXT` или перейти на UUID; автонумерация SQLite `INTEGER PRIMARY KEY` в справочниках — `SERIAL`/`GENERATED`.
3. **Миграции**: Drizzle / Prisma / Knex — одна выбранная система; не смешивать ручные правки на проде без версий.

## Соответствие основных сущностей (из ТЗ и кода)

| ТЗ (Users / Rooms / …) | Факт в проекте |
|------------------------|----------------|
| Users (vk_id, username, …) | `users` + `vk_user_id` / `ok_user_id`, пароли для логина |
| Rooms | Нет отдельной таблицы «комнаты» как в ТЗ: столы живут в Redis authority + live-tables; пользовательские комнаты — `room-registry` / файлы — уточнять при переносе |
| Actions | Игровые события в Redis `events:{tableId}`; долговременные логи — `global_rating_events`, `player_gift_progress_events` и др. |
| Gifts | `gift_catalog`, прогресс — см. миграции в `lib/db.ts` |

## Таблицы в `migrate()` (ориентир для PG)

- `users`, `sessions`, `player_profiles`
- `user_game_state`, `vk_user_game_state`, `ok_user_game_state`
- `vk_payment_orders`, `user_admin_flags`
- Каталоги: `bottle_catalog`, `gift_catalog`, `frame_catalog`, `table_style_catalog`, …
- `status_line`, `lobby_announcement`, `maintenance_mode`
- `achievement_post_templates`, `global_rating_events`, `player_gift_progress_events`
- `vk_ad_reward_claims`, `ticker_player_ads`
- `telegram_stars_pending`, `telegram_stars_payments`
- `game_client_errors`, `admin_player_requests`

## Порядок работ

1. Поднять PostgreSQL, `DATABASE_URL=postgresql://...`
2. Сгенерировать схему и миграции «с нуля» по текущему `migrate()` или экспортировать структуру из SQLite (`sqlite3 .schema`) и адаптировать.
3. **Остановка записей** → дамп SQLite → трансформ и импорт в PG (скрипт ETL) → переключение `getDb()` на PG-адаптер.
4. На переходный период возможен **dual-write** только при жёсткой необходимости; проще — короткое окно обслуживания.

## Риски

- **Синхронизация стола** уже в Redis — не зависит от SQLite для hot-path; миграция БД не должна трогать `lib/table-authority-server.ts` кроме косвенных чтений профилей/экономики.
- Вложенный JSON в колонках (`inventory_json`, `visual_prefs_json`) — проверить экранирование при ETL.
