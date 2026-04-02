import type { Dispatch } from "react"
import type { GameAction } from "@/lib/game-types"

/** Обёрнутый dispatch из useSyncEngine (пушит на сервер). Регистрируется только пока смонтирован game-room. */
let tableSyncDispatch: Dispatch<GameAction> | null = null

export function registerTableSyncDispatch(d: Dispatch<GameAction> | null) {
  tableSyncDispatch = d
}

export function getTableSyncDispatch(): Dispatch<GameAction> | null {
  return tableSyncDispatch
}
