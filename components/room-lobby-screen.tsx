"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { ClipboardPlus, Heart, LayoutGrid, Loader2, ShoppingCart, Sparkles } from "lucide-react"
import { useGame, generateBots } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import { composeTablePlayers } from "@/lib/table-composition"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FortuneWheelBottleVisual } from "@/components/fortune-wheel-bottle-visual"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BottleSkin, InventoryItem, Player } from "@/lib/game-types"
import { buildRestoreGameStateAction } from "@/lib/user-visual-prefs"
import { useGameLayoutMode } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import {
  DEFAULT_ROOM_BOTTLE_SKIN,
  DEFAULT_ROOM_TABLE_STYLE,
  ROOM_TABLE_STYLE_OPTIONS,
  type RoomTableStyle,
} from "@/lib/rooms/room-appearance"
import {
  DEFAULT_BOTTLE_CATALOG_ROWS,
  formatBottleCatalogPrice,
  getBottleCatalogCostFromRows,
  getBottleCatalogRowById,
} from "@/lib/bottle-catalog"
import { useBottleCatalog } from "@/lib/use-bottle-catalog"
import { useTableStyleCatalog } from "@/lib/use-table-style-catalog"
import { getVkMiniAppPageUrl } from "@/lib/game-invite-copy"
import { buyHeartsPack, isVkRuntimeEnvironment, showVkWallPostConfirm } from "@/lib/vk-bridge"
import { formatUserTableSharePostText } from "@/lib/achievement-posts-format"
import { SHARE_USER_TABLE_POST_KEY } from "@/lib/achievement-posts-catalog"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { InlineToast } from "@/components/ui/inline-toast"
import { LobbySpotlightModal } from "@/components/lobby-spotlight-modal"
import {
  readLobbyAnnouncementAcknowledged,
  writeLobbyAnnouncementAcknowledged,
} from "@/lib/lobby-announcement-session"

/** Временно: чекбокс «Рассказать на стене» и окно VK после создания стола отключены. */
const LOBBY_SHARE_TO_WALL_ENABLED = false

type LobbyRow = {
  roomId: number
  name: string
  bottleSkin?: BottleSkin
  tableStyle?: RoomTableStyle
  isUserRoom?: boolean
  createdByUserId?: number
  createdAtMs?: number
  livePlayerCount: number
  maxPlayers: number
}

/** До ответа /api/rooms/lobby — совпадает с `getCreateRoomCost()` (lib/rooms/room-registry). */
const DEFAULT_CREATE_COST = 10
const BUY_HEARTS_AMOUNT = 400
const BUY_HEARTS_VOTES = 25
const LOBBY_VISITED_KEY_PREFIX = "spindate_lobby_visited_v1_"
const VISITED_TTL_MS = 24 * 60 * 60 * 1000
type LobbyTab = "default" | "created"

type CreateBottleOption = { id: BottleSkin; name: string; img?: string; cost: number }

function CreateBottleOptionPreview({ opt, className }: { opt: CreateBottleOption; className?: string }) {
  if (opt.id === "fortune_wheel") {
    return (
      <FortuneWheelBottleVisual
        segmentCount={8}
        className={cn("h-8 w-8 shrink-0 object-contain pointer-events-none select-none", className)}
      />
    )
  }
  if (!opt.img) {
    return <span className={cn("h-8 w-8 shrink-0 rounded-full bg-slate-700/70", className)} aria-hidden />
  }
  return (
    <img
      src={opt.img}
      alt=""
      className={cn("h-8 w-8 shrink-0 object-contain", className)}
      loading="lazy"
    />
  )
}

const TABLE_STYLE_PREVIEW: Record<RoomTableStyle, string> = {
  classic_night: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))",
  sunset_lounge: "linear-gradient(135deg, rgba(146,64,14,0.92), rgba(219,39,119,0.88))",
  ocean_breeze: "linear-gradient(135deg, rgba(8,145,178,0.92), rgba(29,78,216,0.88))",
  violet_dream: "linear-gradient(135deg, rgba(91,33,182,0.92), rgba(147,51,234,0.88))",
  cosmic_rockets:
    "radial-gradient(circle at 30% 20%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(147,51,234,0.25), transparent 55%), linear-gradient(135deg, rgba(2,6,23,0.95), rgba(15,23,42,0.92))",
  light_day:
    "linear-gradient(135deg, rgba(236,253,245,0.95), rgba(224,242,254,0.92) 45%, rgba(250,245,255,0.9))",
  nebula_mockup:
    "radial-gradient(ellipse 90% 70% at 10% 15%, rgba(37,99,235,0.26), transparent 52%), radial-gradient(ellipse 70% 55% at 75% 35%, rgba(124,58,237,0.2), transparent 54%), radial-gradient(ellipse 45% 35% at 50% 95%, rgba(245,158,11,0.16), transparent 55%), linear-gradient(168deg, rgba(15,23,42,0.72), rgba(30,27,75,0.58) 48%, rgba(9,9,26,0.78))",
}

/** VK: query нужен, если нет cookie-сессии (мини-приложение). */
function vkUserIdForApi(user: Player): number | undefined {
  if (typeof user.vkUserId === "number") return user.vkUserId
  if (user.authProvider === "vk" && typeof user.id === "number") return user.id
  return undefined
}

function userStateApiUrl(user: Player): string {
  const vk = vkUserIdForApi(user)
  if (vk != null) return `/api/user/state?vk_user_id=${encodeURIComponent(String(vk))}`
  return "/api/user/state"
}

function createRoomApiUrl(user: Player): string {
  const vk = vkUserIdForApi(user)
  if (vk != null) return `/api/rooms/create?vk_user_id=${encodeURIComponent(String(vk))}`
  return "/api/rooms/create"
}

function visitedStorageKey(user: Player): string {
  const vk = vkUserIdForApi(user)
  return `${LOBBY_VISITED_KEY_PREFIX}${vk != null ? `vk:${vk}` : `u:${user.id}`}`
}

function readVisitedRooms(user: Player): Record<string, number> {
  if (typeof window === "undefined") return {}
  const key = visitedStorageKey(user)
  try {
    const raw = window.localStorage.getItem(key)
    const now = Date.now()
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const clean: Record<string, number> = {}
    for (const [roomId, ts] of Object.entries(parsed)) {
      if (typeof ts === "number" && now - ts < VISITED_TTL_MS) clean[roomId] = ts
    }
    if (JSON.stringify(clean) !== JSON.stringify(parsed)) {
      window.localStorage.setItem(key, JSON.stringify(clean))
    }
    return clean
  } catch {
    return {}
  }
}

function markRoomVisited(user: Player, roomId: number) {
  if (typeof window === "undefined") return
  const key = visitedStorageKey(user)
  const now = Date.now()
  const current = readVisitedRooms(user)
  current[String(roomId)] = now
  try {
    window.localStorage.setItem(key, JSON.stringify(current))
  } catch {
    // ignore
  }
}

export function RoomLobbyScreen() {
  const { state, dispatch } = useGame()
  const { isDesktopUser } = useGameLayoutMode()
  const user = state.currentUser
  const isVkUserForWall = user != null && vkUserIdForApi(user) != null
  const voiceBalance = state.voiceBalance ?? 0
  const { rows: catalogRows } = useBottleCatalog()
  const { rows: tableStyleRows } = useTableStyleCatalog()

  const [rows, setRows] = useState<LobbyRow[]>([])
  const [lobbyLoaded, setLobbyLoaded] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [queuePos, setQueuePos] = useState<number | null>(null)
  const [waitingRoomId, setWaitingRoomId] = useState<number | null>(null)
  const [createCost, setCreateCost] = useState(DEFAULT_CREATE_COST)
  const [buyLoading, setBuyLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("Мой стол")
  const [createBottleSkin, setCreateBottleSkin] = useState<BottleSkin>(DEFAULT_ROOM_BOTTLE_SKIN)
  const [createTableStyle, setCreateTableStyle] = useState<RoomTableStyle>(DEFAULT_ROOM_TABLE_STYLE)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [shareToWall, setShareToWall] = useState(false)
  const { toast, showToast } = useInlineToast(2200)
  const [visitedRooms, setVisitedRooms] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<LobbyTab>("default")

  const [lobbyAnnounceData, setLobbyAnnounceData] = useState<{
    title: string
    body: string
    buttonLabel: string
    imageUrl: string | null
    updatedAt: number
  } | null>(null)
  const [showLobbyAnnounce, setShowLobbyAnnounce] = useState(false)

  const lobbyTableStyleOptions = useMemo(() => {
    const published = new Set(tableStyleRows.filter((r) => r.published).map((r) => r.id))
    const nameById = new Map(tableStyleRows.map((r) => [r.id, r.name]))
    const base = ROOM_TABLE_STYLE_OPTIONS.filter((opt) => published.has(opt.id)).map((opt) => ({
      ...opt,
      name: nameById.get(opt.id) ?? opt.name,
    }))
    return base.length > 0 ? base : ROOM_TABLE_STYLE_OPTIONS
  }, [tableStyleRows])

  const fallbackCreateOption = useMemo<CreateBottleOption>(() => {
    const classic = getBottleCatalogRowById("classic")
    return {
      id: "classic",
      name: classic?.name ?? "Классическая",
      img: classic?.img,
      cost: classic?.cost ?? 0,
    }
  }, [])

  const availableCatalogRows = useMemo(
    () =>
      (catalogRows.length > 0 ? catalogRows : DEFAULT_BOTTLE_CATALOG_ROWS.filter((r) => r.published)).filter(
        (row) => row.published,
      ),
    [catalogRows],
  )

  const createBottleOptions = useMemo<CreateBottleOption[]>(
    () => {
      const mapped = availableCatalogRows.map((row) => ({
        id: row.id,
        name: row.name,
        img: row.img,
        cost: row.cost,
      }))
      return mapped.length > 0 ? mapped : [fallbackCreateOption]
    },
    [availableCatalogRows, fallbackCreateOption],
  )

  const createBottleIds = useMemo(() => new Set(createBottleOptions.map((o) => o.id)), [createBottleOptions])
  const defaultRoomsCount = useMemo(() => rows.filter((r) => !r.isUserRoom).length, [rows])
  const createdRoomsCount = useMemo(() => rows.filter((r) => r.isUserRoom).length, [rows])
  const filteredRows = useMemo(
    () => rows.filter((r) => (activeTab === "default" ? !r.isUserRoom : r.isUserRoom)),
    [rows, activeTab],
  )

  useEffect(() => {
    if (!createBottleIds.has(createBottleSkin)) {
      setCreateBottleSkin(createBottleOptions[0]?.id ?? DEFAULT_ROOM_BOTTLE_SKIN)
    }
  }, [createBottleIds, createBottleOptions, createBottleSkin])

  const lobbyStyleIds = useMemo(() => new Set(lobbyTableStyleOptions.map((o) => o.id)), [lobbyTableStyleOptions])

  useEffect(() => {
    if (!lobbyStyleIds.has(createTableStyle)) {
      setCreateTableStyle(lobbyTableStyleOptions[0]?.id ?? DEFAULT_ROOM_TABLE_STYLE)
    }
  }, [lobbyStyleIds, lobbyTableStyleOptions, createTableStyle])

  useEffect(() => {
    if (createOpen) setShareToWall(false)
  }, [createOpen])

  const fetchLobby = useCallback(async () => {
    try {
      const res = await apiFetch("/api/rooms/lobby", { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.rows)) {
        setRows(data.rows)
        setLobbyLoaded(true)
        if (typeof data.createCost === "number" && data.createCost > 0) {
          setCreateCost(data.createCost)
        }
      }
    } catch {
      setLobbyLoaded(true)
    }
  }, [])

  useEffect(() => {
    void fetchLobby()
    const id = window.setInterval(() => void fetchLobby(), 3000)
    return () => window.clearInterval(id)
  }, [fetchLobby])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(userStateApiUrl(user), { credentials: "include" })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && data?.ok && typeof data.voiceBalance === "number") {
          dispatch(
            buildRestoreGameStateAction(
              data.voiceBalance,
              (Array.isArray(data.inventory) ? data.inventory : []) as InventoryItem[],
              user.id,
              data.visualPrefs,
            ),
          )
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.authProvider, user?.vkUserId, dispatch])

  useEffect(() => {
    if (!user) {
      setVisitedRooms({})
      return
    }
    setVisitedRooms(readVisitedRooms(user))
  }, [user?.id, user?.authProvider, user?.vkUserId])

  useEffect(() => {
    if (!user) {
      setLobbyAnnounceData(null)
      setShowLobbyAnnounce(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch("/api/content/lobby-announcement", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })
        const data = await res.json().catch(() => null)
        if (cancelled || !data?.ok || !data?.announcement) return
        const a = data.announcement as {
          title: string
          body: string
          buttonLabel: string
          imageUrl: string | null
          updatedAt: number
        }
        if (readLobbyAnnouncementAcknowledged(a.updatedAt)) return
        setLobbyAnnounceData(a)
        setShowLobbyAnnounce(true)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.authProvider, user?.vkUserId])

  const enterGameAfterJoin = useCallback(
    async (
      player: Player,
      data: {
        roomId: number
        livePlayers: Player[]
        tablesCount?: number
        createdByUserId?: number
        bottleSkin?: BottleSkin
        tableStyle?: RoomTableStyle
      },
    ) => {
      const maxTableSize = isDesktopUser ? 10 : 6
      const targetMales = isDesktopUser ? 5 : 3
      const targetFemales = isDesktopUser ? 5 : 3
      const allBots = generateBots(220, player.gender)
      const finalPlayers = composeTablePlayers({
        currentUser: { ...player, isBot: false },
        livePlayers: data.livePlayers.map((p) => ({ ...p, isBot: false })),
        existingPlayers: [],
        maxTableSize,
        targetMales,
        targetFemales,
        botPool: allBots,
      }).sort(() => Math.random() - 0.5)

      dispatch({
        type: "SET_TABLE",
        players: finalPlayers,
        tableId: data.roomId,
        roomCreatorPlayerId:
          typeof data.createdByUserId === "number" ? data.createdByUserId : null,
        bottleSkin: data.bottleSkin,
        tableStyle: data.tableStyle,
      })
      dispatch({ type: "SET_TABLES_COUNT", tablesCount: data.tablesCount ?? 1 })
      try {
        const st = await apiFetch("/api/table/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tableId: data.roomId, sinceRevision: 0 }),
        })
        const stData = await st.json().catch(() => null)
        if (st.ok && stData?.snapshot) {
          dispatch({ type: "SYNC_TABLE_AUTHORITY", payload: stData.snapshot })
        }
      } catch {
        // ignore
      }
      dispatch({ type: "SET_SCREEN", screen: "game" })
    },
    [dispatch, isDesktopUser],
  )

  useEffect(() => {
    if (!user || waitingRoomId == null || queuePos == null) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await apiFetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ roomId: waitingRoomId, user }),
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok) {
          setError(typeof data?.error === "string" ? data.error : "Не удалось дождаться входа")
          setQueuePos(null)
          setWaitingRoomId(null)
          return
        }
        if (data.queued) {
          setQueuePos(typeof data.position === "number" ? data.position : 1)
          return
        }
        setQueuePos(null)
        setWaitingRoomId(null)
        await enterGameAfterJoin(user, {
          roomId: data.roomId,
          livePlayers: Array.isArray(data.livePlayers) ? data.livePlayers : [],
          tablesCount: data.tablesCount,
          createdByUserId: typeof data.createdByUserId === "number" ? data.createdByUserId : undefined,
          bottleSkin: typeof data.bottleSkin === "string" ? (data.bottleSkin as BottleSkin) : undefined,
          tableStyle: typeof data.tableStyle === "string" ? (data.tableStyle as RoomTableStyle) : undefined,
        })
        markRoomVisited(user, data.roomId)
      } catch {
        if (!cancelled) setError("Сеть недоступна")
      }
    }
    const timerId = window.setInterval(() => void poll(), 3000)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [enterGameAfterJoin, queuePos, user, waitingRoomId])

  const handleJoin = async (roomId: number) => {
    if (!user) return
    setJoiningId(roomId)
    setError("")
    setQueuePos(null)
    setWaitingRoomId(null)
    try {
      const res = await apiFetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId, user }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(typeof data?.error === "string" ? data.error : "Не удалось войти")
        setJoiningId(null)
        return
      }
      if (data.queued) {
        setQueuePos(typeof data.position === "number" ? data.position : 1)
        setWaitingRoomId(roomId)
        setJoiningId(null)
        return
      }
      setWaitingRoomId(null)
      await enterGameAfterJoin(user, {
        roomId: data.roomId,
        livePlayers: Array.isArray(data.livePlayers) ? data.livePlayers : [],
        tablesCount: data.tablesCount,
        createdByUserId: typeof data.createdByUserId === "number" ? data.createdByUserId : undefined,
        bottleSkin: typeof data.bottleSkin === "string" ? (data.bottleSkin as BottleSkin) : undefined,
        tableStyle: typeof data.tableStyle === "string" ? (data.tableStyle as RoomTableStyle) : undefined,
      })
      markRoomVisited(user, data.roomId)
    } catch {
      setError("Сеть недоступна")
    }
    setJoiningId(null)
  }

  const offerWallPostAfterTableCreate = useCallback(
    async (roomName: string, playerName: string) => {
      const vkOk = await isVkRuntimeEnvironment()
      if (!vkOk) {
        showToast("Публикация на стену доступна в приложении VK", "info")
        return
      }
      try {
        const res = await apiFetch("/api/catalog/achievement-posts", {
          cache: "no-store",
          credentials: "include",
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !Array.isArray(data.rows)) return
        type Row = { achievementKey?: string; postTextTemplate?: string; imageUrl?: string; vkEnabled?: boolean }
        const template = (data.rows as Row[]).find((r) => r.achievementKey === SHARE_USER_TABLE_POST_KEY)
        if (!template || template.vkEnabled !== true) {
          showToast(
            "Шаблон не в каталоге: в админке включите «Публикация в VK», «Публиковать шаблон» и нажмите «Публикация» для share_user_table",
            "info",
          )
          return
        }
        const gameUrl =
          getVkMiniAppPageUrl() ||
          (typeof window !== "undefined" && window.location.origin ? window.location.origin : "") ||
          "https://vk.com/app54511363"
        const message = formatUserTableSharePostText({
          template: typeof template.postTextTemplate === "string" ? template.postTextTemplate : "",
          playerName,
          tableName: roomName,
          gameUrl,
        })
        const img = typeof template.imageUrl === "string" ? template.imageUrl.trim() : ""
        const posted = await showVkWallPostConfirm({
          message,
          imageUrl: img || undefined,
          gameUrl,
        })
        if (posted.ok) {
          showToast(
            posted.usedClipboardFallback
              ? "Шаринг не открылся — текст в буфере, вставьте в личное сообщение"
              : posted.usedShareFallback
                ? "Шаринг: подпись содержит текст и ссылку на картинку — выберите получателя в личных сообщениях"
                : "Открыт пост на стену VK",
            "info",
          )
        }
      } catch {
        /* ignore */
      }
    },
    [showToast],
  )

  const handleCreateRoom = async () => {
    if (!user) return
    setCreateLoading(true)
    setCreateError("")
    try {
      const syncRes = await apiFetch(userStateApiUrl(user), { credentials: "include" })
      const syncData = await syncRes.json().catch(() => null)
      let balance = voiceBalance
      if (syncRes.ok && syncData?.ok && typeof syncData.voiceBalance === "number") {
        balance = syncData.voiceBalance
        dispatch(
          buildRestoreGameStateAction(
            balance,
            (Array.isArray(syncData.inventory) ? syncData.inventory : []) as InventoryItem[],
            user.id,
            syncData.visualPrefs,
          ),
        )
      }
      const bottlePremium = getBottleCatalogCostFromRows(availableCatalogRows, createBottleSkin)
      const totalCharge = createCost + bottlePremium
      if (balance < totalCharge) {
        setCreateError(
          bottlePremium > 0
            ? `Нужно ${totalCharge} ❤ (${createCost} стол + ${bottlePremium} скин). На сервере ${balance} ❤.`
            : `Нужно ${totalCharge} ❤. На сервере сейчас ${balance} ❤.`,
        )
        setCreateLoading(false)
        return
      }

      const res = await apiFetch(createRoomApiUrl(user), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: createName,
          bottleSkin: createBottleSkin,
          tableStyle: createTableStyle,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 401) {
        setCreateError("Войдите в аккаунт (VK или логин), чтобы создать стол.")
        setCreateLoading(false)
        return
      }
      if (!res.ok || !data?.ok) {
        setCreateError(typeof data?.error === "string" ? data.error : "Не удалось создать стол")
        setCreateLoading(false)
        return
      }
      if (typeof data.voiceBalance === "number") {
        dispatch(
          buildRestoreGameStateAction(
            data.voiceBalance,
            (state.inventory ?? []) as InventoryItem[],
            user.id,
            data.visualPrefs,
          ),
        )
      } else {
        dispatch({ type: "PAY_VOICES", amount: totalCharge })
      }
      const wantsWallShare =
        LOBBY_SHARE_TO_WALL_ENABLED && shareToWall && vkUserIdForApi(user) != null
      const roomMeta = data.room as { name?: string } | undefined
      const resolvedRoomName =
        typeof roomMeta?.name === "string" && roomMeta.name.trim() ? roomMeta.name.trim() : createName.trim()
      setCreateOpen(false)
      void fetchLobby()
      if (wantsWallShare) {
        void offerWallPostAfterTableCreate(resolvedRoomName, user.name)
      }
    } catch {
      setCreateError("Ошибка сети")
    }
    setCreateLoading(false)
  }

  const handleBuyHearts = async () => {
    if (!user) return
    setBuyLoading(true)
    try {
      const ok = await buyHeartsPack(400)
      if (ok) {
        const baseline = voiceBalance
        const deadline = Date.now() + 25_000
        while (Date.now() < deadline) {
          const syncRes = await apiFetch(userStateApiUrl(user), { credentials: "include" })
          const syncData = await syncRes.json().catch(() => null)
          if (syncRes.ok && syncData?.ok && typeof syncData.voiceBalance === "number") {
            dispatch(
              buildRestoreGameStateAction(
                syncData.voiceBalance,
                (Array.isArray(syncData.inventory) ? syncData.inventory : []) as InventoryItem[],
                user.id,
                syncData.visualPrefs,
              ),
            )
            if (syncData.voiceBalance >= baseline + BUY_HEARTS_AMOUNT) break
          }
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
    } catch {
      // ignore
    }
    setBuyLoading(false)
  }

  if (!user) {
    return null
  }

  const createBottlePremiumHearts = getBottleCatalogCostFromRows(availableCatalogRows, createBottleSkin)
  const totalCreateCost = createCost + createBottlePremiumHearts
  const canAffordCreate = voiceBalance >= totalCreateCost

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden">
      {queuePos != null && waitingRoomId != null ? (
        <LobbySpotlightModal
          open
          title="Вы находитесь в режиме ожидания"
          body={`До момента, когда игрок покинет игровой стол, мы тебя запустим.\n\nТекущая позиция в очереди: №${queuePos}.`}
          buttonLabel="Ожидаем"
          titleId="room-wait-queue-title"
          onContinue={() => {}}
        />
      ) : null}
      {showLobbyAnnounce && lobbyAnnounceData ? (
        <LobbySpotlightModal
          open
          title={lobbyAnnounceData.title}
          body={lobbyAnnounceData.body}
          buttonLabel={lobbyAnnounceData.buttonLabel}
          imageUrl={lobbyAnnounceData.imageUrl}
          titleId="lobby-announcement-title"
          onContinue={() => {
            writeLobbyAnnouncementAcknowledged(lobbyAnnounceData.updatedAt)
            setShowLobbyAnnounce(false)
          }}
        />
      ) : null}
      {toast ? <InlineToast toast={toast} /> : null}
      <div className="lobby-bg-animated fixed inset-0 -z-0" aria-hidden />
      <div
        className="lobby-orb pointer-events-none fixed -left-1/4 top-[15%] h-[min(55vw,420px)] w-[min(55vw,420px)] rounded-full bg-fuchsia-600/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="lobby-orb-delayed pointer-events-none fixed -right-1/4 bottom-[12%] h-[min(50vw,380px)] w-[min(50vw,380px)] rounded-full bg-cyan-500/20 blur-[90px]"
        aria-hidden
      />

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-3 pt-3 sm:px-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className={cn(
            "lobby-casual-shell mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.14]",
            "bg-[rgba(8,12,22,0.9)] shadow-[0_24px_64px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "backdrop-blur-xl",
            "h-[min(82vh,calc(100dvh-20px))] max-h-[calc(100dvh-12px)]",
          )}
        >
          <div className="lobby-casual-hero shrink-0 border-b border-white/[0.08] px-4 pb-3.5 pt-[1.125rem] text-center sm:px-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
              <Sparkles className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
              <span className="text-[11px] font-semibold leading-tight tracking-wide sm:text-xs">
                Крути и знакомься
              </span>
            </div>
            <h1 className="text-[1.65rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(34,211,238,0.22)] sm:text-3xl">
              Выбор стола
            </h1>
            <p className="lobby-soft-readable mx-auto mt-2 max-w-sm text-[11px] leading-snug text-slate-200 sm:text-sm">
              Игровой стол обновляется в реальном времени. В игре откройте отдельный чат комнаты — кнопка слева внизу.
            </p>
          </div>

          {error ? (
            <div className="shrink-0 border-b border-red-500/20 bg-red-950/30 px-4 py-2 text-center text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="shrink-0 border-b border-white/[0.07] px-3 pb-3 pt-2.5 sm:px-4">
            <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-cyan-200/95 sm:text-xs">
              Нажмите вкладку — куда зайти
            </p>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LobbyTab)} className="w-full">
              <TabsList className="mx-auto flex h-auto min-h-0 w-full max-w-lg min-w-0 flex-nowrap items-stretch justify-center gap-3 rounded-none border-0 !bg-transparent p-0 text-inherit shadow-none ring-0 outline-none sm:gap-4">
                <TabsTrigger
                  value="default"
                  className="flex min-h-[3rem] min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-xl border-2 px-2 py-2.5 text-[13px] font-extrabold leading-tight !text-white transition-colors duration-150 data-[state=inactive]:border-cyan-200/45 data-[state=inactive]:bg-gradient-to-b data-[state=inactive]:from-slate-600/85 data-[state=inactive]:to-slate-800/95 data-[state=inactive]:!text-white data-[state=inactive]:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_8px_rgba(0,0,0,0.35)] data-[state=inactive]:ring-1 data-[state=inactive]:ring-white/20 data-[state=active]:border-amber-100/85 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/40 data-[state=active]:to-emerald-500/35 data-[state=active]:!text-white data-[state=active]:shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_10px_26px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] sm:text-sm sm:leading-snug"
                >
                  <LayoutGrid className="h-5 w-5 shrink-0 text-white drop-shadow-sm sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
                  <span className="text-center">{`Игровые столы (${defaultRoomsCount})`}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="created"
                  className="flex min-h-[3rem] min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-xl border-2 px-2 py-2.5 text-[13px] font-extrabold leading-tight !text-white transition-colors duration-150 data-[state=inactive]:border-cyan-200/45 data-[state=inactive]:bg-gradient-to-b data-[state=inactive]:from-slate-600/85 data-[state=inactive]:to-slate-800/95 data-[state=inactive]:!text-white data-[state=inactive]:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_8px_rgba(0,0,0,0.35)] data-[state=inactive]:ring-1 data-[state=inactive]:ring-white/20 data-[state=active]:border-amber-100/85 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/40 data-[state=active]:to-emerald-500/35 data-[state=active]:!text-white data-[state=active]:shadow-[0_0_0_1px_rgba(34,211,238,0.55),0_10px_26px_rgba(34,211,238,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] sm:text-sm sm:leading-snug"
                >
                  <ClipboardPlus className="h-5 w-5 shrink-0 text-white drop-shadow-sm sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
                  <span className="text-center">{`Созданный стол (${createdRoomsCount})`}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
            <ul className="space-y-2.5 pb-1">
              {filteredRows.length === 0 && !lobbyLoaded && (
                <li className="flex items-center justify-center gap-2 py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <span>Загрузка игрового стола</span>
                </li>
              )}
              {filteredRows.length === 0 && lobbyLoaded && (
                <li className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-300">
                    {activeTab === "default" ? "Игровых столов пока нет" : "Созданных столов пока нет"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {activeTab === "default"
                      ? "Дождитесь появления столов по умолчанию"
                      : "Создайте свой стол, и он появится здесь"}
                  </p>
                </li>
              )}
              {filteredRows.map((r) => {
                const isFull = r.livePlayerCount >= r.maxPlayers
                const fillPct = r.maxPlayers > 0 ? Math.min(100, Math.round((r.livePlayerCount / r.maxPlayers) * 100)) : 0
                const wasHere = typeof visitedRooms[String(r.roomId)] === "number"
                const roomStyle = r.tableStyle ?? DEFAULT_ROOM_TABLE_STYLE
                const roomBottle = r.bottleSkin ?? DEFAULT_ROOM_BOTTLE_SKIN
                const bottleOption =
                  createBottleOptions.find((o) => o.id === roomBottle) ??
                  getBottleCatalogRowById(roomBottle) ??
                  fallbackCreateOption
                const styleName =
                  lobbyTableStyleOptions.find((s) => s.id === roomStyle)?.name ??
                  ROOM_TABLE_STYLE_OPTIONS.find((s) => s.id === roomStyle)?.name ??
                  ROOM_TABLE_STYLE_OPTIONS[0].name
                return (
                  <li
                    key={r.roomId}
                    className={cn(
                      "lobby-casual-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-inner transition",
                      isFull
                        ? "border-red-400/30 bg-red-950/35 hover:bg-red-950/45"
                        : "border-white/10 bg-slate-900/65 hover:border-emerald-400/30 hover:bg-slate-900/85",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-slate-50">
                        {roomNameForDisplay(r.name, r.roomId)}
                      </span>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-200">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-slate-900/70 px-2 py-0.5">
                          <CreateBottleOptionPreview opt={bottleOption} className="!h-4 !w-4 rounded-full" />
                          {bottleOption.name}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full border border-white/20 px-2 py-0.5 text-white/95"
                          style={{ background: TABLE_STYLE_PREVIEW[roomStyle] }}
                        >
                          {styleName}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700/65">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isFull ? "bg-red-500" : fillPct > 60 ? "bg-amber-400" : "bg-emerald-500",
                            )}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-semibold tabular-nums", isFull ? "text-red-300" : "text-slate-300")}>
                          {r.livePlayerCount}/{r.maxPlayers}
                        </span>
                        {isFull && (
                          <span className="rounded-full border border-red-300/30 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                            Занят
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {wasHere && (
                        <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                          Вы были здесь
                        </span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={joiningId !== null || isFull}
                        onClick={() => void handleJoin(r.roomId)}
                        className={cn(
                          "h-10 shrink-0 rounded-full border px-5 font-extrabold",
                          isFull
                            ? "cursor-not-allowed border-slate-500 bg-slate-600 text-slate-200 opacity-50"
                            : "border-emerald-200/80 bg-gradient-to-b from-lime-300 via-emerald-300 to-emerald-500 text-emerald-950 shadow-[0_6px_18px_rgba(74,222,128,0.46)] hover:from-lime-200 hover:via-emerald-200 hover:to-emerald-400",
                        )}
                      >
                        {joiningId === r.roomId ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : isFull ? (
                          "Занят"
                        ) : (
                          "Войти в игру"
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="lobby-casual-footer shrink-0 rounded-b-[1.4rem] border-t border-white/[0.09] bg-slate-950/65 px-4 py-3 backdrop-blur-sm">
            <div className="flex w-full flex-col gap-1.5">
              <p className="rounded-xl border border-white/10 bg-slate-900/55 py-1.5 text-center text-[11px] text-slate-200">
                На балансе:{" "}
                <span className="font-extrabold tabular-nums text-white">{voiceBalance}</span>{" "}
                <span className="text-rose-300" aria-hidden>
                  ❤
                </span>
              </p>
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  disabled={!canAffordCreate}
                  onClick={() => {
                    setCreateError("")
                    setCreateName("Мой стол")
                    setCreateBottleSkin(createBottleOptions[0]?.id ?? DEFAULT_ROOM_BOTTLE_SKIN)
                    setCreateTableStyle(DEFAULT_ROOM_TABLE_STYLE)
                    setCreateOpen(true)
                  }}
                  className={cn(
                    "h-12 flex-1 rounded-2xl border border-emerald-300/60",
                    "bg-gradient-to-r from-emerald-400 via-lime-300 to-teal-300",
                    "text-sm font-extrabold text-emerald-950 shadow-[0_8px_26px_rgba(74,222,128,0.45)] sm:text-base",
                    "hover:from-emerald-400 hover:via-emerald-300 hover:to-teal-300 disabled:opacity-40",
                  )}
                >
                  <Heart className="mr-1.5 h-4 w-4 shrink-0 fill-white/25 text-emerald-950 drop-shadow-sm sm:h-5 sm:w-5" aria-hidden />
                  Создать стол — {totalCreateCost} ❤
                </Button>
                {!canAffordCreate && (
                  <Button
                    type="button"
                    disabled={buyLoading}
                    onClick={() => void handleBuyHearts()}
                    className={cn(
                      "h-12 shrink-0 rounded-2xl border border-violet-300/45",
                      "bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500",
                      "px-3 text-xs font-bold text-white shadow-[0_8px_22px_rgba(139,92,246,0.42)] sm:px-4 sm:text-sm",
                      "hover:from-violet-500 hover:via-violet-400 hover:to-fuchsia-400",
                    )}
                  >
                    {buyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        <ShoppingCart className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                        {BUY_HEARTS_AMOUNT} ❤ = {BUY_HEARTS_VOTES} гол.
                      </>
                    )}
                  </Button>
                )}
              </div>
              {!canAffordCreate ? (
                <p className="text-center text-xs text-amber-200/90">
                  Нужно ещё {Math.max(0, totalCreateCost - voiceBalance)} ❤
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="lobby-casual-dialog border-cyan-300/30 bg-slate-950 text-slate-100 shadow-2xl sm:max-w-lg">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl font-extrabold tracking-tight text-slate-50 sm:text-2xl">Новый стол</DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm leading-relaxed text-slate-300">
                {createBottlePremiumHearts > 0 ? (
                  <>
                    С баланса спишется{" "}
                    <span className="font-extrabold tabular-nums text-amber-200">{totalCreateCost} ❤</span>
                    : {createCost} ❤ за стол +{" "}
                    <span className="font-semibold tabular-nums text-amber-200/80">
                      {createBottlePremiumHearts} ❤
                    </span>{" "}
                    за выбранный скин.
                  </>
                ) : (
                  <>
                    Создание стола —{" "}
                    <span className="font-semibold text-amber-200/90">{createCost} ❤</span> с баланса.
                  </>
                )}{" "}
                Стол сразу виден всем в лобби.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-1">
            <div className="space-y-2">
              <label htmlFor="room-name" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Название
              </label>
              <Input
                id="room-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Например: Вечеринка у бассейна"
                maxLength={64}
                className="h-11 rounded-xl border-cyan-300/40 bg-slate-900/90 text-[15px] font-semibold placeholder:text-slate-500 focus-visible:border-cyan-300/80 focus-visible:ring-cyan-400/30"
              />
            </div>

            <div
              className="rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-slate-900/85 to-slate-950/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(34,211,238,0.08)]"
              role="group"
              aria-label="Оформление стола"
            >
              <p className="mb-3 inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-cyan-100">
                Оформление стола
              </p>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <label htmlFor="create-room-bottle" className="text-sm font-semibold text-slate-200">
                    Бутылочка
                  </label>
                  <span id="create-room-bottle-hint" className="lobby-soft-readable text-[11px] text-slate-300">
                    Скин в центре · цены как при покупке в каталоге
                  </span>
                </div>
                <Select
                  value={createBottleSkin}
                  onValueChange={(v) => setCreateBottleSkin(v as BottleSkin)}
                >
                  <SelectTrigger
                    id="create-room-bottle"
                    aria-describedby="create-room-bottle-hint"
                    aria-label="Выбор скина бутылочки, открыть список"
                    className={cn(
                      "h-auto min-h-[3.25rem] w-full gap-3 rounded-xl border border-cyan-300/35 bg-slate-950/70 px-3 py-2.5 text-left text-slate-100 shadow-sm transition-all",
                      "hover:border-cyan-300/55 hover:bg-slate-900/80",
                      "focus-visible:border-cyan-300/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      "data-[state=open]:border-cyan-300/70 data-[state=open]:bg-slate-900/90 data-[state=open]:shadow-[0_0_20px_-4px_rgba(34,211,238,0.4)]",
                      "data-[state=open]:[&_svg:last-child]:border-white",
                      "[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1",
                      "[&_svg:last-child]:ml-auto [&_svg:last-child]:size-6 [&_svg:last-child]:shrink-0 [&_svg:last-child]:rounded-full [&_svg:last-child]:border-2 [&_svg:last-child]:border-white/90 [&_svg:last-child]:bg-slate-950 [&_svg:last-child]:p-1 [&_svg:last-child]:!text-white [&_svg:last-child]:opacity-100 [&_svg:last-child]:[stroke-width:3]",
                    )}
                  >
                    <SelectValue placeholder="Выберите скин" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={6}
                    className="z-[200] max-h-[min(340px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-violet-500/20 bg-slate-950 p-1.5 text-slate-100 shadow-2xl shadow-black/50"
                  >
                    {createBottleOptions.map((opt) => {
                      const cost = opt.cost
                      return (
                        <SelectItem
                          key={opt.id}
                          value={opt.id}
                          className="cursor-pointer rounded-lg py-2 pl-2 pr-10 focus:bg-violet-950/50 focus:text-slate-50 data-[highlighted]:bg-slate-800/80"
                        >
                          <span className="flex w-full min-w-0 items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80">
                              <CreateBottleOptionPreview opt={opt} className="!h-7 !w-7" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">
                              {opt.name}
                            </span>
                            <span
                              className="shrink-0 text-xs font-bold tabular-nums text-amber-200/90"
                              title="Цена в каталоге бутылочек"
                            >
                              {formatBottleCatalogPrice(cost)}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-600/80 to-transparent" aria-hidden />

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-200">Стилистика стола</p>
                <p className="lobby-soft-readable text-[11px] leading-snug text-slate-300">
                  Фон и атмосфера комнаты для всех игроков
                </p>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {lobbyTableStyleOptions.map((opt) => {
                    const selected = createTableStyle === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCreateTableStyle(opt.id)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left text-xs font-medium transition-all",
                          selected
                            ? "lobby-style-card-active border-cyan-200/90 bg-cyan-500/24 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_28px_rgba(34,211,238,0.34),inset_0_1px_0_rgba(255,255,255,0.14)]"
                            : "border-slate-700/90 bg-slate-950/50 text-slate-300 hover:border-slate-500 hover:bg-slate-900/60",
                        )}
                      >
                        <span
                          className="mb-2 block h-7 rounded-lg border border-white/15 shadow-inner"
                          style={{ background: TABLE_STYLE_PREVIEW[opt.id] }}
                        />
                        <span className={cn(selected ? "font-bold" : "font-medium")}>{opt.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {LOBBY_SHARE_TO_WALL_ENABLED && isVkUserForWall ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-900/50 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={shareToWall}
                  onChange={(e) => setShareToWall(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-950"
                />
                <span className="text-sm leading-snug text-slate-300">
                  <span className="font-semibold text-slate-100">Рассказать на стене</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    После создания откроется окно VK — можно опубликовать пост друзьям со ссылкой на игру.
                  </span>
                </span>
              </label>
            ) : null}

            {createError ? <p className="text-sm text-red-300">{createError}</p> : null}
          </div>
          <DialogFooter className="gap-3 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-slate-500 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={createLoading || !canAffordCreate}
              onClick={() => void handleCreateRoom()}
              className="border border-emerald-200/70 bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-300 font-extrabold text-emerald-950 shadow-[0_12px_30px_rgba(74,222,128,0.5)] hover:from-emerald-300 hover:via-lime-200 hover:to-emerald-200"
            >
              {createLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-1 text-[1.02rem] sm:text-[1.08rem]">
                  Создать за <span className="font-black tabular-nums">{totalCreateCost} ❤</span>
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
