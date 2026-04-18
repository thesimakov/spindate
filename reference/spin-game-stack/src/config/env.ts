import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  /** Для продакшена: секрет приложения VK для проверки подписи launch params */
  VK_SECURE_KEY: z.string().optional(),
  /** Разрешить вход по заголовку (только dev) */
  DEV_VK_BYPASS: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.string().default("*"),
})

export type Env = z.infer<typeof schema>

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`)
  }
  return parsed.data
}
