import { createHmac } from "node:crypto"

/**
 * Проверка подписи параметров запуска VK Mini App.
 * @see https://github.com/VKCOM/vk-apps-launch-params
 */
export function verifyVkLaunchParams(search: string, secretKey: string): boolean {
  const parsed = parseVkLaunchVkPairs(search)
  if (!parsed) return false
  const { sign, vkPairs } = parsed
  const queryString = vkPairs
    .sort((a, b) => a.key.localeCompare(b.key))
    .reduce((acc, { key, value }, idx) => acc + (idx === 0 ? "" : "&") + `${key}=${encodeURIComponent(value)}`, "")

  const paramsHash = createHmac("sha256", secretKey)
    .update(queryString)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=$/, "")

  return paramsHash === sign
}

function parseVkLaunchVkPairs(search: string): { sign: string; vkPairs: { key: string; value: string }[] } | null {
  const formatted = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(formatted)
  let sign: string | undefined
  const vkPairs: { key: string; value: string }[] = []
  for (const [key, value] of params.entries()) {
    if (key === "sign") {
      sign = value
    } else if (key.startsWith("vk_")) {
      vkPairs.push({ key, value })
    }
  }
  if (!sign || vkPairs.length === 0) return null
  return { sign, vkPairs }
}

export function parseVkUserIdFromLaunchSearch(search: string): number | null {
  const formatted = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(formatted)
  const raw = params.get("vk_user_id")
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function parseVkAppIdFromLaunchSearch(search: string): number | null {
  const formatted = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(formatted)
  const raw = params.get("vk_app_id")
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
