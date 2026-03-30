"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useGame, generateBots } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import { composeTablePlayers } from "@/lib/table-composition"
import type { Player, GameAction, TableAuthorityPayload } from "@/lib/game-types"

function isTableSyncedAction(action: GameAction): boolean {
  switch (action.type) {
    case "START_COUNTDOWN":
    case "TICK_COUNTDOWN":
    case "START_SPIN":
    case "STOP_SPIN":
    case "NEXT_TURN":
    case "REQUEST_EXTRA_TURN":
    case "ADD_LOG":
    case "SEND_GENERAL_CHAT":
    case "SET_AVATAR_FRAME":
    case "ADD_DRUNK_TIME":
    case "SET_BOTTLE_SKIN":
    case "SET_BOTTLE_DONOR":
    case "RESET_ROUND":
    case "SET_BOTTLE_COOLDOWN_UNTIL":
    case "SET_CLIENT_TAB_AWAY":
      return true
    default:
      return false
  }
}

const LIVE_POLL_MS = 3000
const AUTHORITY_POLL_MS = 800
const MAX_TABLE_SIZE = 10
const TARGET_MALES = 5
const TARGET_FEMALES = 5

export interface SyncEngineResult {
  dispatch: (action: GameAction) => void
  syncLiveTable: (mode: "join" | "sync", forceNew?: boolean) => Promise<{ tableId: number; liveCount: number } | null>
  fetchTableAuthority: (tid: number) => Promise<void>
  tableLiveReady: boolean
  tableAuthorityReady: boolean
}

export function useSyncEngine(): SyncEngineResult {
  const { state, dispatch: rawDispatch } = useGame()
  const { currentUser, tableId, players, tablePaused } = state

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

  const pushTableAction = useCallback(async (action: GameAction) => {
    const current = syncMetaRef.current
    if (!current.userId || !current.tableId) return
    try {
      await apiFetch("/api/table/events", {
        method: "POST",
        cache: "no-store" as RequestCache,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "push",
          tableId: current.tableId,
          senderId: current.userId,
          action,
        }),
      })
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

  const lastSyncAppliedAtRef = useRef(0)
  const pendingSyncRef = useRef<TableAuthorityPayload | null>(null)
  const syncDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const SYNC_DEBOUNCE_MS = 500

  const doApply = useCallback(
    (payload: TableAuthorityPayload) => {
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
      const elapsed = Date.now() - lastSyncAppliedAtRef.current
      if (elapsed >= SYNC_DEBOUNCE_MS) {
        doApply(payload)
        return
      }
      pendingSyncRef.current = payload
      if (syncDebounceTimerRef.current) return
      syncDebounceTimerRef.current = setTimeout(() => {
        syncDebounceTimerRef.current = null
        if (pendingSyncRef.current) doApply(pendingSyncRef.current)
      }, SYNC_DEBOUNCE_MS - elapsed)
    },
    [doApply],
  )

  const [tableLiveReady, setTableLiveReady] = useState(false)
  const [tableAuthorityReady, setTableAuthorityReady] = useState(false)

  useEffect(() => {
    setTableLiveReady(false)
    setTableAuthorityReady(false)
  }, [currentUser?.id])

  const fetchTableAuthority = useCallback(
    async (tid: number) => {
      const since = lastAuthorityRevisionRef.current
      try {
        const res = await apiFetch("/api/table/state", {
          method: "POST",
          cache: "no-store" as RequestCache,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tableId: tid, sinceRevision: since }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !data.snapshot) return
        const snap = data.snapshot as TableAuthorityPayload
        if (snap.revision > since) {
          applyAuthoritySnapshot(snap)
        }
        setTableAuthorityReady(true)
      } catch {
        setTableAuthorityReady(true)
      }
    },
    [applyAuthoritySnapshot],
  )

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

  const syncLiveTable = useCallback(
    async (mode: "join" | "sync", forceNew = false) => {
      if (!currentUser) return null
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
        if (!res.ok || !data?.ok || !Array.isArray(data.livePlayers)) return null
        const livePlayers = data.livePlayers.map((p: Player) => ({ ...p, isBot: false }))
        const nextPlayers = composePlayersFromLive(livePlayers)
        const nextTableId = typeof data.tableId === "number" ? data.tableId : currentTableId
        const tableActuallyChanged = nextTableId !== currentTableId
        if (tableActuallyChanged || forceNew) {
          dispatch({ type: "SET_TABLE", players: nextPlayers, tableId: nextTableId })
          lastAuthorityRevisionRef.current = 0
        } else {
          dispatch({ type: "SET_PLAYERS", players: nextPlayers })
        }
        if (typeof data.tablesCount === "number") {
          dispatch({ type: "SET_TABLES_COUNT", tablesCount: data.tablesCount })
        }
        await fetchTableAuthority(nextTableId)
        setTableLiveReady(true)
        return { tableId: nextTableId, liveCount: livePlayers.length }
      } catch {
        setTableLiveReady(true)
        return null
      }
    },
    [currentUser, composePlayersFromLive, dispatch, fetchTableAuthority],
  )

  // Live polling: join then sync every 3s
  const initialJoinDoneRef = useRef(false)
  useEffect(() => {
    initialJoinDoneRef.current = false
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser || tablePaused) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      if (!initialJoinDoneRef.current) {
        initialJoinDoneRef.current = true
        await syncLiveTable("join")
      } else {
        await syncLiveTable("sync")
      }
    }

    void tick()
    const interval = setInterval(() => { void tick() }, LIVE_POLL_MS)

    const onFocus = () => { void tick() }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [currentUser, syncLiveTable, tablePaused])

  // Authority polling: every 800ms
  useEffect(() => {
    if (!currentUser || tablePaused) return
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      await fetchTableAuthority(tableId)
    }

    void poll()
    const interval = setInterval(() => { void poll() }, AUTHORITY_POLL_MS)

    const onFocus = () => { void poll() }
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [currentUser, tableId, fetchTableAuthority, tablePaused])

  // Leave table on unmount / page close
  useEffect(() => {
    if (!currentUser) return
    const payload = JSON.stringify({ mode: "leave", userId: currentUser.id })
    const leave = () => {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/table/live", new Blob([payload], { type: "application/json" }))
      } else {
        void apiFetch("/api/table/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: payload,
        }).catch(() => {})
      }
    }

    const onBeforeUnload = () => leave()
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      leave()
    }
  }, [currentUser])

  return useMemo(() => ({
    dispatch,
    syncLiveTable,
    fetchTableAuthority,
    tableLiveReady,
    tableAuthorityReady,
  }), [dispatch, syncLiveTable, fetchTableAuthority, tableLiveReady, tableAuthorityReady])
}
