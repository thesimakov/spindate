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

const LIVE_POLL_MS = 2500
const AUTHORITY_POLL_MS = 650
const LIVE_POLL_HIDDEN_MS = 6000
const AUTHORITY_POLL_HIDDEN_MS = 5000
const AUTHORITY_POLL_IDLE_MAX_MS = 2600
const MAX_TABLE_SIZE = 10
const TARGET_MALES = 5
const TARGET_FEMALES = 5

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
  const { currentUser, tableId, players, tablePaused, isSpinning, showResult, countdown, currentTurnIndex, roundNumber } = state

  const remoteActionRef = useRef(false)
  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])

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

  const pushTableAction = useCallback(async (action: GameAction) => {
    const current = syncMetaRef.current
    const tid = Math.floor(Number(current.tableId))
    if (!current.userId || !Number.isInteger(tid) || tid <= 0) return
    if (!seatConfirmedRef.current) {
      return
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
        const pull = fetchTableAuthorityRef.current
        if (pull) {
          window.setTimeout(() => {
            void pull(tid)
          }, 120)
        }
      }
    } catch {
      // state will converge on next authority poll
    }
  }, [])

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
    seatConfirmedRef.current = seatConfirmed
  }, [seatConfirmed])

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
  }, [currentUser?.id])

  useEffect(() => {
    if (tablePaused) {
      if (loseSeatDebounceRef.current) {
        clearTimeout(loseSeatDebounceRef.current)
        loseSeatDebounceRef.current = null
      }
      setSeatConfirmed(false)
      setTableLiveReady(false)
    }
  }, [tablePaused])

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
    (livePlayers: Player[]) => {
      if (!currentUser) return playersRef.current
      const bots = generateBots(220, currentUser.gender)
      return composeTablePlayers({
        currentUser: { ...currentUser, isBot: false },
        livePlayers: livePlayers.map((p) => ({ ...p, isBot: false })),
        existingPlayers: playersRef.current,
        maxTableSize: MAX_TABLE_SIZE,
        targetMales: TARGET_MALES,
        targetFemales: TARGET_FEMALES,
        botPool: bots,
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
        const nextPlayers = composePlayersFromLive(livePlayers)
        const nextTableId = typeof data.tableId === "number" ? data.tableId : currentTableId
        const tableActuallyChanged = nextTableId !== currentTableId
        const prevPlayerIds = playersRef.current.map((p) => p.id).join(",")
        const nextPlayerIds = nextPlayers.map((p) => p.id).join(",")
        const activePhase = isSpinning || showResult || countdown !== null
        if (activePhase && prevPlayerIds !== nextPlayerIds) {
          // #region agent log
          process.env.NODE_ENV === 'development' && fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'822343'},body:JSON.stringify({sessionId:'822343',runId:'post-fix',hypothesisId:'H10',location:'hooks/use-sync-engine.ts:syncLiveTable',message:'Live players changed during active phase',data:{tableId:currentTableId,roundNumber,currentTurnIndex,isSpinning,showResult,countdown,prevPlayerIds,nextPlayerIds,livePlayersCount:livePlayers.length,tableActuallyChanged},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        if (!tableActuallyChanged && prevPlayerIds === nextPlayerIds) {
          // #region agent log
          process.env.NODE_ENV === 'development' && fetch('http://127.0.0.1:7715/ingest/dea135a8-847a-49d0-810c-947ce095950e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'822343'},body:JSON.stringify({sessionId:'822343',runId:'post-fix',hypothesisId:'H10',location:'hooks/use-sync-engine.ts:syncLiveTable',message:'SET_PLAYERS candidate without player-id changes',data:{tableId:currentTableId,roundNumber,currentTurnIndex,isSpinning,showResult,countdown,playerIds:nextPlayerIds,livePlayersCount:livePlayers.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
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
        } else {
          dispatch({ type: "SET_PLAYERS", players: nextPlayers })
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
  }, [currentUser?.id])

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

  // Send leave on tab close / navigation away / VK WebView close.
  // beforeunload + pagehide cover desktop browsers, mobile Safari, and VK WebView.
  // On refresh the page re-mounts and immediately re-joins via syncLiveTable("join").
  const currentUserId = currentUser?.id ?? null
  const leaveSentRef = useRef(false)
  useEffect(() => {
    if (!currentUserId) return
    leaveSentRef.current = false
    const payload = JSON.stringify({ mode: "leave", userId: currentUserId })
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
  }, [currentUserId])

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
