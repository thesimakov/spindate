import cron from "node-cron"
import { purgeAllRoomChatHistory } from "@/lib/rooms/chat-service"

const MSK_TIMEZONE = "Europe/Moscow"

/** Одна итерация очистки (внутренний cron, HTTP cron, тесты). */
export async function runRoomChatPurgeJob(): Promise<void> {
  await purgeAllRoomChatHistory()
  try {
    console.info("[room-chat] история чатов комнат очищена (00:00 МСК)")
  } catch {
    /* ignore */
  }
}

function isInternalSchedulerDisabled(): boolean {
  const v = process.env.DISABLE_ROOM_CHAT_INTERNAL_SCHEDULER?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

let purgeSchedulerStarted = false

/**
 * Каждый день в 00:00 Europe/Moscow — полная очистка чатов комнат (Redis + память).
 *
 * Несколько инстансов: задайте `DISABLE_ROOM_CHAT_INTERNAL_SCHEDULER=true` и один раз в сутки
 * вызывайте `POST /api/cron/room-chat-purge` с секретом `CRON_SECRET` (см. маршрут).
 */
export function startRoomChatMidnightPurgeScheduler(): void {
  if (purgeSchedulerStarted) return
  purgeSchedulerStarted = true

  if (isInternalSchedulerDisabled()) {
    console.info(
      "[room-chat] внутренний планировщик отключён (DISABLE_ROOM_CHAT_INTERNAL_SCHEDULER); очистка — через POST /api/cron/room-chat-purge",
    )
    return
  }

  cron.schedule(
    "0 0 * * *",
    () => {
      void runRoomChatPurgeJob().catch((e) => {
        console.error("[room-chat] ошибка очистки чатов", e)
      })
    },
    { timezone: MSK_TIMEZONE },
  )
}
