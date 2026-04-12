import { createHash } from "node:crypto"

/**
 * Проверка подписи параметров запуска ОК (как в REST API: сортировка ключей, конкатенация key=value, + секрет приложения, MD5).
 * @see https://apiok.ru/dev/methods/
 */
export function verifyOkLaunchParams(params: Record<string, string>, applicationSecret: string): boolean {
  const secret = applicationSecret.trim()
  if (!secret) return false
  const sig = params.sig ?? params.signature
  if (!sig || typeof sig !== "string") return false

  const copy: Record<string, string> = { ...params }
  delete copy.sig
  delete copy.signature

  const keys = Object.keys(copy).sort()
  let base = ""
  for (const k of keys) {
    base += `${k}=${copy[k]}`
  }
  const digest = createHash("md5").update(base + secret, "utf8").digest("hex").toLowerCase()
  return digest === String(sig).trim().toLowerCase()
}

export function parseOkLoggedUserId(params: Record<string, string>): number | null {
  const raw = params.logged_user_id ?? params.user_id
  if (raw == null || typeof raw !== "string") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export function parseOkApplicationKey(params: Record<string, string>): string | null {
  const k = params.application_key
  return typeof k === "string" && k.trim() ? k.trim() : null
}
