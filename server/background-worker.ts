/**
 * Фоновый воркер BullMQ: награды, миссии, аналитика.
 * Запуск: `REDIS_URL=... npm run worker` (отдельный процесс PM2/контейнер).
 */
import { Worker } from "bullmq"
import { BACKGROUND_QUEUE_NAME, getBullmqConnection } from "@/lib/jobs/bullmq-connection"

const connection = getBullmqConnection()

const worker = new Worker(
  BACKGROUND_QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case "analytics":
        // Здесь: батчи событий в хранилище аналитики
        break
      case "rewards":
        // Здесь: начисления после проверки условий
        break
      case "missions":
        // Здесь: прогресс ежедневных миссий и т.п.
        break
      default:
        break
    }
  },
  { connection },
)

worker.on("failed", (job, err) => {
  console.error("[background-worker] job failed", job?.id, job?.name, err)
})

worker.on("error", (err) => {
  console.error("[background-worker]", err)
})

process.on("SIGTERM", async () => {
  await worker.close()
  await connection.quit()
  process.exit(0)
})

process.stdout.write(`[background-worker] listening queue=${BACKGROUND_QUEUE_NAME}\n`)
