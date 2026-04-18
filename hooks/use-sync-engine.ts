"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useGame, generateBots } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import { appPath } from "@/lib/app-path"
import { composeTablePlayers } from "@/lib/table-composition"
import { registerTableSyncDispatch } from "@/lib/table-sync-registry"
import { generateLogId } from "@/lib/ids"
import { tableJoinAnnouncementText } from "@/lib/join-table-announcement"
import type { Player, GameAction, TableAuthorityPayload } from "@/lib/game-types"

function isTableSyncedAction(action: GameAction): boolean {
  switch (action.type) {
    case "START_COUNTDOWN":
    case "TICK_COUNTDOWN":
    case "START_SPIN":
    case "STOP_SPIN":
    case "BEGIN_PAIR_KISS_PHASE":
    case "SET_PAIR_KISS_CHOICE":
    case "FINALIZE_PAIR_KISS":
    case "NEXT_TURN":
    case "REQUEST_EXTRA_TURN":
    case "ADD_LOG":
    case "SEND_GENERAL_CHAT":
    case "SET_AVATAR_FRAME":
    case "ADD_DRUNK_TIME":
    case "SET_BOTTLE_SKIN":
    case "SET_BOTTLE_DONOR":
    case "SET_BOTTLE_TABLE_PURCHASE":
    case "RESET_ROUND":
    case "SET_BOTTLE_COOLDOWN_UNTIL":
    case "SET_CLIENT_TAB_AWAY":
    case "START_PREDICTION_PHASE":
    case "END_PREDICTION_PHASE":
    case "ADD_PREDICTION":
    case "PLACE_BET":
      return true
    default:
      return false
  }
}

const LIVE_POLL_MS = 1800
const AUTHORITY_POLL_MS = 800
/** Опрос ленты /api/table/events (pull), чтобы подтянуть рамки/лог и пр. без ожидания «медленного» authority-poll. */
const TABLE_EVENTS_POLL_MS = 650
const LIVE_POLL_HIDDEN_MS = 3000
const AUTHORITY_POLL_HIDDEN_MS = 5000
const AUTHORITY_POLL_IDLE_MAX_MS = 3200
/** Первый pull с sinceSeq выше любого seq — только currentSeq, без скачивания истории событий. */
const TABLE_EVENTS_INIT_SINCE_SEQ = 0x7fffffff
const MAX_TABLE_SIZE = 10
const TARGET_MALES = 5
const TARGET_FEMALES = 5
const RECENT_BOT_MEMORY_SIZE = 80

function shufflePlayers(list: Player[]): Player[] {
  const bots = [...list]
  for (let i = bots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = bots[i]!
    bots[i] = bots[j]!
    bots[j] = t
  }
  return bots
}

function buildShuffledBotPool(userGender: Player["gender"], recentBotIds: Set<number>): Player[] {
  const bots = generateBots(220, userGender)
  const fresh = bots.filter((b) => !recentBotIds.has(b.id))
  const recent = bots.filter((b) => recentBotIds.has(b.id))
  return [...shufflePlayers(fresh), ...shufflePlayers(recent)]
}

export interface SyncEngineResult {
  dispatch: (action: GameAction) => void
  syncLiveTable: (mode: "join" | "sync", forceNew?: boolean) => Promise<{ tableId: number; liveCount: number } | null>
  fetchTableAuthority: (tid: number) => Promise<void>
  tableLiveReady: boolean
  tableAuthorityReady: boolean
  /** Сервер подтвердил, что вы в списке живых за столом (ответ /api/table/live). */
  seatConfirmed: boolean
  /** Сколько живых игроков на столе по последнему успешному live-ответу. */
  liveHumanCount: number
}

export function useSyncEngine(): SyncEngineResult {
  const { state, dispatch: rawDispatch } = useGame()
  const { currentUser, tableId, players, tablePaused, isSpinning, showResult, countdown, avatarFrames } = state
  const emitSeatSyncLog = useCallback((event: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "development") return
    console.debug("[seat-sync]", { event, ...(data ?? {}) })
  }, [])

  const remoteActionRef = useRef(false)
  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])
  const botPoolRef = useRef<Player[]>([])
  const recentBotIdsRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    botPoolRef.current = []
    recentBotIdsRef.current = new Set()
  }, [currentUser?.id])

  const lastAuthorityRevisionRef = useRef(0)

  const syncMetaRef = useRef<{ tableId: number; userId: number | null }>({
    tableId,
    userId: currentUser?.id ?? null,
  })
  useEffect(() => {
    syncMetaRef.current = { tableId, userId: currentUser?.id ?? null }
  }, [tableId, currentUser?.id])

  useEffect(() => {
    lastAuthorityRevisionRef.current = 0
  }, [tableId])

  /** Обновляется ниже из seatConfirmed — пушим события только после подтверждённого места за live-столом. */
  const seatConfirmedRef = useRef(false)

  /** Заполняется после объявления fetchTableAuthority — для догонки снимка после успешного push. */
  const fetchTableAuthorityRef = useRef<((tid: number) => Promise<void>) | null>(null)

  /** Очередь push: два параллельных applyAuthorityEvent на одном столе могут гоняться в Redis RMW — сериализуем. */
  const pushChainRef = useRef(Promise.resolve())
  useEffect(() => {
    pushChainRef.current = Promise.resolve()
  }, [tableId])
  const frameResyncKeyRef = useRef<string>("")

  const pushTableAction = useCallback((action: GameAction) => {
    pushChainRef.current = pushChainRef.current
      .catch(() => {})
      .then(async () => {
        const current = syncMetaRef.current
        const tid = Math.floor(Number(current.tableId))
        if (!current.userId || !Number.isInteger(tid) || tid <= 0) return
        if (!seatConfirmedRef.current) {
          emitSeatSyncLog("push_blocked_no_seat", {
            tableId: tid,
            userId: current.userId,
            actionType: action.type,
          })
          return
        }
        const pullAuthoritySoon = () => {
          const pull = fetchTableAuthorityRef.current
          if (pull) {
            window.setTimeout(() => {
              void pull(tid)
            }, 120)
          }
        }
        try {
          const res = await apiFetch("/api/table/events", {
            method: "POST",
            cache: "no-store" as RequestCache,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              mode: "push",
              tableId: tid,
              senderId: current.userId,
              action,
            }),
          })
          if (res.ok) {
            pullAuthoritySoon()
          } else {
            // Сервер отклонил событие или снимок не изменился — подтянуть авторитет сразу, иначе локальный спин/ход может «залипнуть».
            pullAuthoritySoon()
          }
        } catch {
          pullAuthoritySoon()
        }
      })
    void pushChainRef.current
  }, [emitSeatSyncLog])

  const dispatch = useCallback((action: GameAction) => {
    rawDispatch(action)
    if (remoteActionRef.current) return
    if (!isTableSyncedAction(action)) return
    void pushTableAction(action)
  }, [rawDispatch, pushTableAction])

  useEffect(() => {
    registerTableSyncDispatch(dispatch)
    return () => registerTableSyncDispatch(null)
  }, [dispatch])

  const lastSyncAppliedAtRef = useRef(0)
  const pendingSyncRef = useRef<TableAuthorityPayload | null>(null)
  const syncDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveSyncInFlightRef = useRef(false)
  const pendingLiveSyncRef = useRef<{ mode: "join" | "sync"; forceNew: boolean } | null>(null)
  const authorityPollInFlightRef = useRef(false)
  /** Если запрос /table/state уже идёт — догоняющий poll запоминаем и выполняем сразу после. */
  const pendingAuthorityTableIdRef = useRef<number | null>(null)
  const authorityStablePollCountRef = useRef(0)
  const authorityPollMsRef = useRef(AUTHORITY_POLL_MS)
  const SYNC_DEBOUNCE_MS = 200

  const doApply = useCallback(
    (payload: TableAuthorityPayload) => {
      if (payload.revision <= lastAuthorityRevisionRef.current) return
      lastAuthorityRevisionRef.current = payload.revision
      lastSyncAppliedAtRef.current = Date.now()
      pendingSyncRef.current = null
      remoteActionRef.current = true
      try {
        rawDispatch({ type: "SYNC_TABLE_AUTHORITY", payload })
      } finally {
        remoteActionRef.current = false
      }
    },
    [rawDispatch],
  )

  const applyAuthoritySnapshot = useCallback(
    (payload: TableAuthorityPayload) => {
      if (payload.revision <= lastAuthorityRevisionRef.current) return
      const elapsed = Date.now() - lastSyncAppliedAtRef.current
      if (elapsed >= SYNC_DEBOUNCE_MS) {
        doApply(payload)
        return
      }
      pendingSyncRef.current = payload
      if (syncDebounceTimerRef.current) return
      syncDebounceTimerRef.current = setTimeout(() => {
        syncDebounceTimerRef.current = null
        if (pendingSyncRef.current && pendingSyncRef.current.revision > lastAuthorityRevisionRef.current) {
          doApply(pendingSyncRef.current)
        }
      }, SYNC_DEBOUNCE_MS - elapsed)
    },
    [doApply],
  )

  const [tableLiveReady, setTableLiveReady] = useState(false)
  const [tableAuthorityReady, setTableAuthorityReady] = useState(false)
  const [seatConfirmed, setSeatConfirmed] = useState(false)
  const [liveHumanCount, setLiveHumanCount] = useState(0)

  useEffect(() => {
    const prev = seatConfirmedRef.current
    seatConfirmedRef.current = seatConfirmed
    if (prev !== seatConfirmed) {
      emitSeatSyncLog("seat_confirmed_changed", {
        tableId: tableIdRef.current,
        userId: currentUser?.id ?? null,
        previous: prev,
        next: seatConfirmed,
      })
    }
  }, [seatConfirmed, emitSeatSyncLog, currentUser?.id])

  /** Краткая задержка перед сбросом «места», чтобы не мигало при редком ответе без seated */
  const loseSeatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LOSE_SEAT_DEBOUNCE_MS = 380

  useEffect(() => {
    if (loseSeatDebounceRef.current) {
      clearTimeout(loseSeatDebounceRef.current)
      loseSeatDebounceRef.current = null
    }
    authorityStablePollCountRef.current = 0
    authorityPollMsRef.current = AUTHORITY_POLL_MS
    pendingLiveSyncRef.current = null
    setTableLiveReady(false)
    setTableAuthorityReady(false)
    setSeatConfirmed(false)
    setLiveHumanCount(0)
    frameResyncKeyRef.current = ""
  }, [currentUser?.id])

  useEffect(() => {
    if (tablePaused) {
      if (loseSeatDebounceRef.current) {
        clearTimeout(loseSeatDebounceRef.current)
        loseSeatDebounceRef.current = null
      }
      setSeatConfirmed(false)
      setTableLiveReady(false)
      frameResyncKeyRef.current = ""
    }
  }, [tablePaused])

  /**
   * После join/refresh повторно публикуем текущую рамку игрока в authority.
   * Иначе при пересборке живого стола (например, тех-режим/refresh) таблица может
   * временно потерять avatarFrames и другие игроки не увидят рамку, хотя она куплена/сохранена.
   */
  useEffect(() => {
    if (!currentUser || tablePaused || !seatConfirmed || !tableAuthorityReady) return
    const frameId = avatarFrames?.[currentUser.id]
    if (!frameId || frameId === "none") return
    const syncKey = `${tableId}:${currentUser.id}:${frameId}`
    if (frameResyncKeyRef.current === syncKey) return
    frameResyncKeyRef.current = syncKey
    pushTableAction({ type: "SET_AVATAR_FRAME", playerId: currentUser.id, frameId })
    emitSeatSyncLog("resync_avatar_frame_after_join", {
      tableId,
      userId: currentUser.id,
      frameId,
    })
  }, [
    currentUser?.id,
    tableId,
    tablePaused,
    seatConfirmed,
    tableAuthorityReady,
    avatarFrames,
    pushTableAction,
    emitSeatSyncLog,
  ])

  const fetchTableAuthority = useCallback(
    async (tid: number) => {
      if (authorityPollInFlightRef.current) {
        pendingAuthorityTableIdRef.current = tid
        return
      }
      authorityPollInFlightRef.current = true
      const maxAttempts = 12
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const res = await apiFetch("/api/table/state", {
              method: "POST",
              cache: "no-store" as RequestCache,
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tableId: tid, sinceRevision: lastAuthorityRevisionRef.current }),
            })
            const data = await res.json().catch(() => null)
            if (res.ok && data?.ok && data.snapshot) {
              const snap = data.snapshot as TableAuthorityPayload
              const changed = data.changed !== false
              if (snap.revision > lastAuthorityRevisionRef.current) {
                applyAuthoritySnapshot(snap)
              }
              if (changed) {
                authorityStablePollCountRef.current = 0
                authorityPollMsRef.current = AUTHORITY_POLL_MS
              } else {
                authorityStablePollCountRef.current += 1
                authorityPollMsRef.current = Math.min(
                  AUTHORITY_POLL_IDLE_MAX_MS,
                  AUTHORITY_POLL_MS + authorityStablePollCountRef.current * 250,
                )
              }
              setTableAuthorityReady(true)
              return
            }
          } catch {
            // retry
          }
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 80 + attempt * 40))
          }
        }
        // Не блокируем вход навсегла: следующий poll подтянет снимок.
        authorityPollMsRef.current = Math.min(AUTHORITY_POLL_IDLE_MAX_MS, authorityPollMsRef.current + 400)
        setTableAuthorityReady(true)
      } finally {
        authorityPollInFlightRef.current = false
        const queued = pendingAuthorityTableIdRef.current
        pendingAuthorityTableIdRef.current = null
        if (queued != null && Number.isInteger(queued) && queued > 0) {
          queueMicrotask(() => {
            void fetchTableAuthority(queued)
          })
        }
      }
    },
    [applyAuthoritySnapshot],
  )

  useEffect(() => {
    fetchTableAuthorityRef.current = fetchTableAuthority
  }, [fetchTableAuthority])

  const composePlayersFromLive = useCallback(
    (
      livePlayers: Player[],
      options?: { reuseExistingBots?: boolean },
    ) => {
      if (!currentUser) return playersRef.current
      const reuseExistingBots = options?.reuseExistingBots !== false
      if (!reuseExistingBots || botPoolRef.current.length === 0) {
        botPoolRef.current = buildShuffledBotPool(currentUser.gender, recentBotIdsRef.current)
      }
      return composeTablePlayers({
        currentUser: { ...currentUser, isBot: false },
        livePlayers: livePlayers.map((p) => ({ ...p, isBot: false })),
        existingPlayers: reuseExistingBots ? playersRef.current : [],
        maxTableSize: MAX_TABLE_SIZE,
        targetMales: TARGET_MALES,
        targetFemales: TARGET_FEMALES,
        botPool: botPoolRef.current,
      })
    },
    [currentUser],
  )

  const tableIdRef = useRef(tableId)
  useEffect(() => { tableIdRef.current = tableId }, [tableId])

  /** Кто уже был в списке живых за этим столом — чтобы один раз писать в общий лог «присоединился». */
  const prevLiveHumanIdsRef = useRef<Set<number>>(new Set())
  const prevTrackedTableIdForLiveRef = useRef<number>(0)

  const syncLiveTable = useCallback(
    async (mode: "join" | "sync", forceNew = false) => {
      if (!currentUser) return null
      if (liveSyncInFlightRef.current) {
        const prev = pendingLiveSyncRef.current
        pendingLiveSyncRef.current = {
          mode: prev?.mode === "join" || mode === "join" ? "join" : "sync",
          forceNew: Boolean(prev?.forceNew || forceNew),
        }
        return null
      }
      liveSyncInFlightRef.current = true
      const currentTableId = tableIdRef.current
      try {
        const res = await apiFetch("/api/table/live", {
          method: "POST",
          cache: "no-store" as RequestCache,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode,
            forceNew,
            user: currentUser,
            tableId: currentTableId,
            maxTableSize: MAX_TABLE_SIZE,
          }),
        })
        const data = await res.json().catch(() => null)
        if (res.status === 410) {
          dispatch({ type: "SET_SCREEN", screen: "lobby" })
          return null
        }
        if (!res.ok || !data?.ok || !Array.isArray(data.livePlayers)) return null
        const livePlayers = data.livePlayers.map((p: Player) => ({ ...p, isBot: false }))
        const seated = livePlayers.some((p: Player) => p.id === currentUser.id)
        if (!seated) {
          emitSeatSyncLog("live_sync_not_seated", {
            mode,
            tableId: currentTableId,
            userId: currentUser.id,
            livePlayersCount: livePlayers.length,
          })
          seatConfirmedRef.current = false
          prevLiveHumanIdsRef.current = new Set()
          if (!loseSeatDebounceRef.current) {
            loseSeatDebounceRef.current = setTimeout(() => {
              loseSeatDebounceRef.current = null
              setSeatConfirmed(false)
              setTableLiveReady(false)
            }, LOSE_SEAT_DEBOUNCE_MS)
          }
          return null
        }
        if (loseSeatDebounceRef.current) {
          clearTimeout(loseSeatDebounceRef.current)
          loseSeatDebounceRef.current = null
        }
        setSeatConfirmed(true)
        seatConfirmedRef.current = true
        setLiveHumanCount(livePlayers.length)
        const nextTableId = typeof data.tableId === "number" ? data.tableId : currentTableId
        const tableActuallyChanged = nextTableId !== currentTableId
        const shouldReshuffleBots = tableActuallyChanged || forceNew || mode === "join"
        const nextPlayers = composePlayersFromLive(livePlayers, {
          reuseExistingBots: !shouldReshuffleBots,
        })
        if (shouldReshuffleBots) {
          const chosenBotIds = nextPlayers.filter((p) => p.isBot).map((p) => p.id)
          if (chosenBotIds.length > 0) {
            const merged = [...chosenBotIds, ...Array.from(recentBotIdsRef.current)]
            recentBotIdsRef.current = new Set(merged.slice(0, RECENT_BOT_MEMORY_SIZE))
          }
        }
        const prevPlayerIds = playersRef.current.map((p) => p.id).join(",")
        const nextPlayerIds = nextPlayers.map((p) => p.id).join(",")
        const activePhase = isSpinning || showResult || countdown !== null
        void activePhase
        void prevPlayerIds
        void nextPlayerIds
        const createdByUserId =
          typeof data.createdByUserId === "number" && Number.isFinite(data.createdByUserId)
            ? data.createdByUserId
            : null
        if (tableActuallyChanged || forceNew) {
          dispatch({
            type: "SET_TABLE",
            players: nextPlayers,
            tableId: nextTableId,
            roomCreatorPlayerId: createdByUserId,
          })
          lastAuthorityRevisionRef.current = 0
        } else if (!tableAuthorityReady) {
          // До первого authority-снимка показываем локально собранный стол.
          // После готовности authority не перетираем состав локальной композицией live-sync,
          // иначе у разных клиентов кратковременно расходится порядок/боты.
          dispatch({ type: "SET_PLAYERS", players: nextPlayers })
        } else {
          emitSeatSyncLog("skip_set_players_authority_ready", {
            tableId: nextTableId,
            livePlayersCount: livePlayers.length,
          })
        }
        if (typeof data.tablesCount === "number") {
          dispatch({ type: "SET_TABLES_COUNT", tablesCount: data.tablesCount })
        }

        if (prevTrackedTableIdForLiveRef.current !== nextTableId) {
          prevTrackedTableIdForLiveRef.current = nextTableId
          prevLiveHumanIdsRef.current = new Set()
        }
        const incomingHumanIds = new Set<number>(livePlayers.map((p: Player) => p.id))
        for (const hid of incomingHumanIds) {
          if (prevLiveHumanIdsRef.current.has(hid)) continue
          if (hid !== currentUser.id) continue
          dispatch({
            type: "ADD_LOG",
            entry: {
              id: generateLogId(),
              type: "join",
              fromPlayer: currentUser,
              text: tableJoinAnnouncementText(currentUser.name.trim() || "Игрок", currentUser.gender),
              timestamp: Date.now(),
            },
          })
          break
        }
        prevLiveHumanIdsRef.current = incomingHumanIds

        // Первый вход/смена стола: сразу тянем authority.
        // Обычные sync-тиki не должны каждый раз дублировать /api/table/state,
        // этим занимается отдельный authority-poller.
        const shouldFetchAuthorityNow =
          mode === "join" || forceNew || tableActuallyChanged || !tableAuthorityReady
        if (shouldFetchAuthorityNow) {
          await fetchTableAuthority(nextTableId)
        }
        setTableLiveReady(true)
        return { tableId: nextTableId, liveCount: livePlayers.length }
      } catch {
        return null
      } finally {
        liveSyncInFlightRef.current = false
        const queued = pendingLiveSyncRef.current
        pendingLiveSyncRef.current = null
        if (queued) {
          queueMicrotask(() => {
            void syncLiveTable(queued.mode, queued.forceNew)
          })
        }
      }
    },
    [currentUser, composePlayersFromLive, dispatch, fetchTableAuthority, tableAuthorityReady],
  )

  // Live polling: join then sync every 3s
  const initialJoinDoneRef = useRef(false)
  useEffect(() => {
    initialJoinDoneRef.current = false
  }, [currentUser?.id, tableId])

  useEffect(() => {
    if (!currentUser || tablePaused) return
    let cancelled = false
    let timeoutId: number | null = null

    const tick = async () => {
      if (cancelled) return
      if (!initialJoinDoneRef.current) {
        const joined = await syncLiveTable("join")
        // Переключаемся на обычный sync только после успешного join.
        if (joined) initialJoinDoneRef.current = true
      } else {
        await syncLiveTable("sync")
      }
      if (cancelled) return
      const hidden = typeof document !== "undefined" && document.visibilityState !== "visible"
      timeoutId = window.setTimeout(tick, hidden ? LIVE_POLL_HIDDEN_MS : LIVE_POLL_MS)
    }

    void tick()

    const onFocus = () => { void tick() }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [currentUser, syncLiveTable, tablePaused])

  /** Пока сервер не подтвердил место за столом — чаще повторяем join (стол собирается в фоне лоадера). */
  useEffect(() => {
    if (!currentUser || tablePaused || seatConfirmed) return
    const id = window.setInterval(() => {
      void syncLiveTable("join")
    }, 2000)
    return () => void clearInterval(id)
  }, [currentUser, tablePaused, seatConfirmed, syncLiveTable])

  // Authority polling: после подтверждения места за столом.
  useEffect(() => {
    if (!currentUser || tablePaused || !seatConfirmed) return
    let cancelled = false
    let timeoutId: number | null = null

    const poll = async () => {
      if (cancelled) return
      await fetchTableAuthority(tableId)
      if (cancelled) return
      const hidden = typeof document !== "undefined" && document.visibilityState !== "visible"
      const nextDelay = hidden
        ? Math.max(authorityPollMsRef.current, AUTHORITY_POLL_HIDDEN_MS)
        : authorityPollMsRef.current
      timeoutId = window.setTimeout(poll, nextDelay)
    }

    void poll()

    const onFocus = () => { void poll() }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [currentUser, tableId, fetchTableAuthority, tablePaused, seatConfirmed])

  /** Курсор по ленте событий стола (seq ≠ revision authority). */
  const tableEventsCursorRef = useRef<{ seq: number; initialized: boolean }>({ seq: 0, initialized: false })
  useEffect(() => {
    tableEventsCursorRef.current = { seq: 0, initialized: false }
  }, [tableId])

  // Лента событий: при новых записях подтягиваем authority — иначе при «тихом» столе поллинг state разгоняется до нескольких секунд и рамки/лог подарков отстают.
  useEffect(() => {
    if (!currentUser || tablePaused || !seatConfirmed) return
    let cancelled = false
    let timeoutId: number | null = null

    const pollTableEvents = async () => {
      if (cancelled) return
      const tid = Math.floor(Number(tableIdRef.current))
      if (!Number.isInteger(tid) || tid <= 0) return
      const cur = tableEventsCursorRef.current
      try {
        const sinceSeq = cur.initialized ? cur.seq : TABLE_EVENTS_INIT_SINCE_SEQ
        const res = await apiFetch("/api/table/events", {
          method: "POST",
          cache: "no-store" as RequestCache,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tableId: tid, sinceSeq }),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          currentSeq?: number
          events?: unknown[]
        } | null
        if (!res.ok || !data?.ok || typeof data.currentSeq !== "number") return

        if (!cur.initialized) {
          tableEventsCursorRef.current = { seq: data.currentSeq, initialized: true }
          return
        }

        tableEventsCursorRef.current = { seq: data.currentSeq, initialized: true }
        if (Array.isArray(data.events) && data.events.length > 0) {
          const pull = fetchTableAuthorityRef.current
          if (pull) void pull(tid)
        }
      } catch {
        // ignore
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      timeoutId = window.setTimeout(() => {
        void pollTableEvents().finally(() => {
          if (!cancelled) scheduleNext()
        })
      }, TABLE_EVENTS_POLL_MS)
    }

    void pollTableEvents().finally(() => {
      if (!cancelled) scheduleNext()
    })

    return () => {
      cancelled = true
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [currentUser, tableId, tablePaused, seatConfirmed])

  // Send leave on tab close / navigation away / VK WebView close.
  // beforeunload + pagehide cover desktop browsers, mobile Safari, and VK WebView.
  // On refresh the page re-mounts and immediately re-joins via syncLiveTable("join").
  const currentUserId = currentUser?.id ?? null
  const leaveSentRef = useRef(false)
  useEffect(() => {
    if (!currentUserId) return
    leaveSentRef.current = false
    const payload = JSON.stringify({ mode: "leave", userId: currentUserId, tableId: tableIdRef.current })
    const sendLeave = (_reason: string) => {
      if (leaveSentRef.current) {
        return
      }
      leaveSentRef.current = true
      const useBeacon =
        typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      if (useBeacon) {
        navigator.sendBeacon(appPath("/api/table/live"), new Blob([payload], { type: "application/json" }))
      } else {
        void apiFetch("/api/table/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: payload,
        }).catch(() => {})
      }
    }

    const onBeforeUnload = () => sendLeave("beforeunload")
    const onPageHide = () => sendLeave("pagehide")
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("pagehide", onPageHide)
      sendLeave("unmount_cleanup")
    }
  }, [currentUserId, tableId])

  return useMemo(() => ({
    dispatch,
    syncLiveTable,
    fetchTableAuthority,
    tableLiveReady,
    tableAuthorityReady,
    seatConfirmed,
    liveHumanCount,
  }), [dispatch, syncLiveTable, fetchTableAuthority, tableLiveReady, tableAuthorityReady, seatConfirmed, liveHumanCount])
}
