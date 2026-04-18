import "server-only"

import { Queue } from "bullmq"
import { BACKGROUND_QUEUE_NAME, getBullmqConnection } from "@/lib/jobs/bullmq-connection"

let queueSingleton: Queue | null = null

export function getBackgroundQueue(): Queue {
  if (!queueSingleton) {
    queueSingleton = new Queue(BACKGROUND_QUEUE_NAME, {
      connection: getBullmqConnection(),
    })
  }
  return queueSingleton
}

/** Постановка аналитики / наград / миссий в фон (не блокирует API). */
export async function enqueueBackgroundJob(
  name: "analytics" | "rewards" | "missions",
  data: Record<string, unknown>,
): Promise<void> {
  const q = getBackgroundQueue()
  await q.add(name, data, {
    removeOnComplete: 500,
    removeOnFail: 200,
  })
}
