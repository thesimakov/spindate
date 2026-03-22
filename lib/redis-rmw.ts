import type Redis from "ioredis"

/**
 * Оптимистичная блокировка: WATCH + GET + MULTI SET.
 * При конфликте EXEC вернёт null — повторяем до maxRetries.
 */
export async function readModifyWriteKey(
  redis: Redis,
  key: string,
  modify: (raw: string | null) => string | null,
  maxRetries = 25,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await redis.watch(key)
    const raw = await redis.get(key)
    const next = modify(raw)
    if (next === raw) {
      await redis.unwatch()
      return
    }
    const multi = redis.multi()
    if (next === null) {
      multi.del(key)
    } else {
      multi.set(key, next)
    }
    const result = await multi.exec()
    if (result !== null) return
  }
  throw new Error(`readModifyWriteKey: не удалось записать после ${maxRetries} попыток: ${key}`)
}
