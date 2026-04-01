"use client"

import { useEffect, useState, useCallback } from "react"
import { Heart, Loader2, Sparkles, ShoppingCart } from "lucide-react"
import { useGame, generateBots } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import { composeTablePlayers } from "@/lib/table-composition"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { InventoryItem, Player } from "@/lib/game-types"
import { useGameLayoutMode } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import { buyHearts200 } from "@/lib/vk-bridge"

type LobbyRow = { roomId: number; name: string; livePlayerCount: number; maxPlayers: number }

const DEFAULT_CREATE_COST = 100
const BUY_HEARTS_AMOUNT = 200
const BUY_HEARTS_VOTES = 9

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

export function RoomLobbyScreen() {
  const { state, dispatch } = useGame()
  const { isDesktopUser } = useGameLayoutMode()
  const user = state.currentUser
  const voiceBalance = state.voiceBalance ?? 0

  const [rows, setRows] = useState<LobbyRow[]>([])
  const [lobbyLoaded, setLobbyLoaded] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [queuePos, setQueuePos] = useState<number | null>(null)
  const [createCost, setCreateCost] = useState(DEFAULT_CREATE_COST)
  const [buyLoading, setBuyLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("Мой стол")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")

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

  const enterGameAfterJoin = async (
    player: Player,
    data: { roomId: number; livePlayers: Player[]; tablesCount?: number; createdByUserId?: number },
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
      })
    } catch {
      setError("Сеть недоступна")
    }
    setJoiningId(null)
  }

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
      if (balance < createCost) {
        setCreateError(`Нужно ${createCost} ❤. На сервере сейчас ${balance} ❤.`)
        setCreateLoading(false)
        return
      }

      const res = await apiFetch(createRoomApiUrl(user), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: createName }),
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
        dispatch({ type: "PAY_VOICES", amount: createCost })
      }
      setCreateOpen(false)
      void fetchLobby()
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

  const canAffordCreate = voiceBalance >= createCost

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden">
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4">
            <ul className="space-y-2.5 pb-1">
              {rows.length === 0 && !lobbyLoaded && (
                <li className="flex items-center justify-center gap-2 py-10 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <span>Загрузка игрового стола</span>
                </li>
              )}
              {rows.length === 0 && lobbyLoaded && (
                <li className="flex flex-col items-center gap-2 py-10 text-center">
                  <p className="text-sm font-medium text-slate-400">Столов пока нет</p>
                  <p className="text-[11px] text-slate-500">Создайте свой стол или дождитесь появления новых</p>
                </li>
              )}
              {rows.map((r) => {
                const isFull = r.livePlayerCount >= r.maxPlayers
                const fillPct = r.maxPlayers > 0 ? Math.min(100, Math.round((r.livePlayerCount / r.maxPlayers) * 100)) : 0
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
                  Создать стол — {createCost} ❤
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
                  Нужно ещё {createCost - voiceBalance} ❤
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый стол</DialogTitle>
            <DialogDescription className="text-slate-400">
              С вашего баланса спишется {createCost} ❤. Стол появится в списке для всех игроков.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <label htmlFor="room-name" className="text-sm text-slate-300">
              Название
            </label>
            <Input
              id="room-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например: Вечеринка у бассейна"
              maxLength={64}
              className="border-slate-600 bg-slate-900"
            />
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
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Создать за ${createCost} ❤`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
