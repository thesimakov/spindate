/**
 * Запускается один раз при старте Node-процесса Next.js (сервер).
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startRoomChatMidnightPurgeScheduler } = await import("@/lib/rooms/chat-purge-scheduler")
  startRoomChatMidnightPurgeScheduler()
}
