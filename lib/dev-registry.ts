/**
 * Реестр пользователей и блокировки для страницы разработчиков.
 * Всё хранится в localStorage (ключи с префиксом spindate_dev_).
 */

const REGISTRY_KEY = "spindate_dev_registry"
const BLOCKED_KEY = "spindate_dev_blocked"
const BANNED_KEY = "spindate_dev_banned"

export interface DevUserEntry {
  id: number
  name: string
  /** Имя из VK (если вход через VK). */
  vkName?: string
  age: number
  city?: string
  authProvider?: "vk" | "ok" | "login"
  /** Логин (только для authProvider === "login") */
  login?: string
  /** Пароль на клиенте не хранится — только подпись для разработчиков */
  passwordNote: "не хранится на клиенте"
  /** Устройство/платформа при регистрации */
  platform: string
  addedAt: number
}

function getRegistry(): Record<number, DevUserEntry> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function setRegistry(registry: Record<number, DevUserEntry>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry))
  } catch {
    // ignore
  }
}

/** Добавить/обновить пользователя в реестре (вызывать при регистрации/входе) */
export function addToDevRegistry(
  user: { id: number; name: string; age: number; city?: string; authProvider?: "vk" | "ok" | "login" },
  login?: string,
): void {
  const platform =
    typeof navigator !== "undefined"
      ? /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
        ? "мобильное"
        : "десктоп"
      : "—"
  const registry = getRegistry()
  registry[user.id] = {
    id: user.id,
    name: user.name,
    vkName: user.authProvider === "vk" ? user.name : undefined,
    age: user.age,
    city: user.city,
    authProvider: user.authProvider,
    login: user.authProvider === "login" ? login ?? user.name : undefined,
    passwordNote: "не хранится на клиенте",
    platform,
    addedAt: registry[user.id]?.addedAt ?? Date.now(),
  }
  setRegistry(registry)
}

/** Список всех пользователей в реестре */
export function getDevRegistryUsers(): DevUserEntry[] {
  const registry = getRegistry()
  return Object.values(registry).sort((a, b) => b.addedAt - a.addedAt)
}

/** ID заблокированных (навсегда) */
export function getBlockedUserIds(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(BLOCKED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function setBlockedUserIds(ids: number[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BLOCKED_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function blockUser(userId: number) {
  const ids = getBlockedUserIds()
  if (!ids.includes(userId)) setBlockedUserIds([...ids, userId])
  unbanUser(userId)
}

export function unblockUser(userId: number) {
  setBlockedUserIds(getBlockedUserIds().filter((id) => id !== userId))
}

/** Забаненные до указанного timestamp */
export interface BannedEntry {
  userId: number
  until: number
}

export function getBannedList(): BannedEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(BANNED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function setBannedList(list: BannedEntry[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BANNED_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

/** Забанить на 24 часа */
export function banUser24h(userId: number) {
  const list = getBannedList().filter((e) => e.userId !== userId)
  list.push({ userId, until: Date.now() + 24 * 60 * 60 * 1000 })
  setBannedList(list)
  unblockUser(userId)
}

export function unbanUser(userId: number) {
  setBannedList(getBannedList().filter((e) => e.userId !== userId))
}

/** Проверить, заблокирован ли пользователь */
export function isUserBlocked(userId: number): boolean {
  return getBlockedUserIds().includes(userId)
}

/** Проверить, забанен ли пользователь (и не истек ли бан) */
export function isUserBanned(userId: number): { banned: boolean; until?: number } {
  const list = getBannedList()
  const now = Date.now()
  const entry = list.find((e) => e.userId === userId)
  if (!entry) return { banned: false }
  if (entry.until <= now) {
    unbanUser(userId)
    return { banned: false }
  }
  return { banned: true, until: entry.until }
}
