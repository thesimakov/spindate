/**
 * Запускается при старте Node-процесса Next.js.
 * Планировщик очистки чатов комнат НЕ подключаем отсюда: иначе сборщик тянет ioredis
 * в контекст instrumentation и падает с Can't resolve 'stream'.
 * См. `startRoomChatMidnightPurgeScheduler()` в `lib/rooms/room-services.ts` (первый `getRoomServices()`).
 * Внешний cron: `POST /api/cron/room-chat-purge` с `CRON_SECRET`.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
}
