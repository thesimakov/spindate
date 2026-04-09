"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Heart, Loader2, Sparkles, ShoppingCart } from "lucide-react"
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
import { buyHearts200, isVkRuntimeEnvironment, showVkWallPostConfirm } from "@/lib/vk-bridge"
import { formatUserTableSharePostText } from "@/lib/achievement-posts-format"
import { SHARE_USER_TABLE_POST_KEY } from "@/lib/achievement-posts-catalog"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { InlineToast } from "@/components/ui/inline-toast"

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

const DEFAULT_CREATE_COST = 100
const BUY_HEARTS_AMOUNT = 200
const BUY_HEARTS_VOTES = 9
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
          dispatch({
            type: "RESTORE_GAME_STATE",
            voiceBalance: data.voiceBalance,
            inventory: (Array.isArray(data.inventory) ? data.inventory : []) as InventoryItem[],
          })
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

  const enterGameAfterJoin = async (
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
  }

  const handleJoin = async (roomId: number) => {
    if (!user) return
    setJoiningId(roomId)
    setError("")
    setQueuePos(null)
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
        setJoiningId(null)
        return
      }
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
          showToast("Пост на стену не включён (админка → посты достижений)", "info")
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
            posted.usedStoryFallback
              ? "Пост на стену недоступен: открыт редактор истории VK со ссылкой на игру"
              : posted.usedShareFallback
                ? "Пост на стену недоступен: текст скопирован, открыт шаринг со ссылкой на игру"
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
        dispatch({
          type: "RESTORE_GAME_STATE",
          voiceBalance: balance,
          inventory: (Array.isArray(syncData.inventory) ? syncData.inventory : []) as InventoryItem[],
        })
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
        dispatch({
          type: "RESTORE_GAME_STATE",
          voiceBalance: data.voiceBalance,
          inventory: state.inventory ?? [],
        })
      } else {
        dispatch({ type: "PAY_VOICES", amount: totalCharge })
      }
      const wantsWallShare = shareToWall && vkUserIdForApi(user) != null
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
      const ok = await buyHearts200()
      if (ok) {
        const baseline = voiceBalance
        const deadline = Date.now() + 25_000
        while (Date.now() < deadline) {
          const syncRes = await apiFetch(userStateApiUrl(user), { credentials: "include" })
          const syncData = await syncRes.json().catch(() => null)
          if (syncRes.ok && syncData?.ok && typeof syncData.voiceBalance === "number") {
            dispatch({
              type: "RESTORE_GAME_STATE",
              voiceBalance: syncData.voiceBalance,
              inventory: (Array.isArray(syncData.inventory) ? syncData.inventory : []) as InventoryItem[],
            })
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
            "mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[1.35rem] border border-white/[0.12]",
            "bg-[rgba(8,12,22,0.88)] shadow-[0_24px_64px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "backdrop-blur-xl",
            "h-[min(82vh,calc(100dvh-20px))] max-h-[calc(100dvh-12px)]",
          )}
        >
          <div className="shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-4 text-center sm:px-5">
            <div className="mb-1.5 inline-flex items-center gap-2 text-cyan-200/95">
              <Sparkles className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
              <span className="text-[11px] font-semibold leading-tight tracking-wide sm:text-xs">
                Крути и знакомься
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">Выбор стола</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[11px] leading-snug text-slate-400 sm:text-sm">
              Игровой стол обновляется в реальном времени. В игре откройте отдельный чат комнаты — кнопка слева внизу.
            </p>
          </div>

          {queuePos != null && (
            <div className="shrink-0 border-b border-amber-500/20 bg-amber-950/35 px-4 py-2.5 text-center text-sm text-amber-100">
              Все столы заняты. Вы в очереди: №{queuePos}
            </div>
          )}
          {error ? (
            <div className="shrink-0 border-b border-red-500/20 bg-red-950/30 px-4 py-2 text-center text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="shrink-0 border-b border-white/[0.06] px-3 pb-2 pt-2 sm:px-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LobbyTab)} className="w-full">
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-slate-900/65 p-1">
                <TabsTrigger
                  value="default"
                  className="rounded-lg text-xs font-semibold text-slate-200 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100 data-[state=active]:shadow-none"
                >
                  {`Игровые столы (${defaultRoomsCount})`}
                </TabsTrigger>
                <TabsTrigger
                  value="created"
                  className="rounded-lg text-xs font-semibold text-slate-200 data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100 data-[state=active]:shadow-none"
                >
                  {`Созданный стол (${createdRoomsCount})`}
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
                  <p className="text-sm font-medium text-slate-400">
                    {activeTab === "default" ? "Игровых столов пока нет" : "Созданных столов пока нет"}
                  </p>
                  <p className="text-[11px] text-slate-500">
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
                      "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-inner transition",
                      isFull
                        ? "border-red-500/20 bg-red-950/30 hover:bg-red-950/40"
                        : "border-white/8 bg-slate-900/55 hover:border-emerald-500/25 hover:bg-slate-900/80",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-100">
                        {roomNameForDisplay(r.name, r.roomId)}
                      </span>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-300">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-900/50 px-2 py-0.5">
                          <CreateBottleOptionPreview opt={bottleOption} className="!h-4 !w-4 rounded-full" />
                          {bottleOption.name}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full border border-white/15 px-2 py-0.5"
                          style={{ background: TABLE_STYLE_PREVIEW[roomStyle] }}
                        >
                          {styleName}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isFull ? "bg-red-500" : fillPct > 60 ? "bg-amber-400" : "bg-emerald-500",
                            )}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <span className={cn("text-xs tabular-nums", isFull ? "text-red-300" : "text-slate-400")}>
                          {r.livePlayerCount}/{r.maxPlayers}
                        </span>
                        {isFull && (
                          <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
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
                          "shrink-0 rounded-full px-5 font-semibold text-white",
                          isFull
                            ? "cursor-not-allowed bg-slate-600 opacity-50"
                            : "bg-emerald-600 shadow-[0_4px_14px_rgba(22,163,74,0.45)] hover:bg-emerald-500",
                        )}
                      >
                        {joiningId === r.roomId ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : isFull ? (
                          "Занят"
                        ) : (
                          "Войти"
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div
            className={cn(
              "shrink-0 border-t border-white/[0.08] bg-slate-950/55 px-4 py-3 backdrop-blur-sm",
              "rounded-b-[1.25rem]",
            )}
          >
            <div className="flex w-full flex-col gap-1.5">
              <p className="text-center text-[11px] text-slate-400">
                На балансе:{" "}
                <span className="font-semibold tabular-nums text-white">{voiceBalance}</span>{" "}
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
                    "h-12 flex-1 rounded-2xl border border-emerald-400/45",
                    "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400",
                    "text-sm font-semibold text-emerald-950 shadow-[0_6px_26px_rgba(16,185,129,0.45)] sm:text-base",
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
                      "h-12 shrink-0 rounded-2xl border border-violet-400/40",
                      "bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500",
                      "px-3 text-xs font-semibold text-white shadow-[0_6px_22px_rgba(139,92,246,0.4)] sm:px-4 sm:text-sm",
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
        <DialogContent className="border-slate-600/90 bg-slate-950 text-slate-100 shadow-2xl sm:max-w-lg">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-50">Новый стол</DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm leading-relaxed text-slate-400">
                {createBottlePremiumHearts > 0 ? (
                  <>
                    С баланса спишется{" "}
                    <span className="font-bold tabular-nums text-amber-200/95">{totalCreateCost} ❤</span>
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
                className="h-11 rounded-xl border-slate-600 bg-slate-900/90 text-[15px] placeholder:text-slate-600 focus-visible:border-violet-400/50 focus-visible:ring-violet-500/25"
              />
            </div>

            <div
              className="rounded-2xl border border-slate-700/90 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              role="group"
              aria-label="Оформление стола"
            >
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Оформление стола</p>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <label htmlFor="create-room-bottle" className="text-sm font-semibold text-slate-200">
                    Бутылочка
                  </label>
                  <span id="create-room-bottle-hint" className="text-[11px] text-slate-500">
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
                      "h-auto min-h-[3.25rem] w-full gap-3 rounded-xl border border-slate-600/90 bg-slate-950/60 px-3 py-2.5 text-left text-slate-100 shadow-sm transition-all",
                      "hover:border-slate-500 hover:bg-slate-900/70",
                      "focus-visible:border-violet-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      "data-[state=open]:border-violet-400/50 data-[state=open]:bg-slate-900/80 data-[state=open]:shadow-[0_0_20px_-4px_rgba(167,139,250,0.35)]",
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
                <p className="text-[11px] leading-snug text-slate-500">Фон и атмосфера комнаты для всех игроков</p>
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
                            ? "border-cyan-400/70 bg-cyan-500/12 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : "border-slate-700/90 bg-slate-950/50 text-slate-300 hover:border-slate-500 hover:bg-slate-900/60",
                        )}
                      >
                        <span
                          className="mb-2 block h-7 rounded-lg border border-white/15 shadow-inner"
                          style={{ background: TABLE_STYLE_PREVIEW[opt.id] }}
                        />
                        {opt.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {isVkUserForWall ? (
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-600">
              Отмена
            </Button>
            <Button
              type="button"
              disabled={createLoading || !canAffordCreate}
              onClick={() => void handleCreateRoom()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold text-emerald-950 hover:from-emerald-400 hover:to-teal-400"
            >
              {createLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Создать за ${totalCreateCost} ❤`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
