import type { LivePlayer } from "@/lib/live-tables-core"
import type { Player } from "@/lib/game-types"
import { joinSpecificRoom, leaveLiveTable, getTableInfo } from "@/lib/live-tables-server"
import { ensureTableAuthority, getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { isRoomDisabledForJoin, loadRoomRegistry } from "@/lib/rooms/room-registry"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import type { LobbyRoomRow, RoomStatePayload } from "@/lib/rooms/types"
import { DEFAULT_ROOM_BOTTLE_SKIN, normalizeRoomBottleSkin } from "@/lib/rooms/room-appearance"
import { resolveEffectiveTableStyle } from "@/lib/table-style-global-server"
import { QueueManager } from "@/lib/rooms/queue-manager"
import { ROOM_MAX_PLAYERS } from "@/lib/rooms/bot-manager"

export function toLivePlayer(player: Player): LivePlayer {
  const { isBot: _b, online: _o, ...rest } = player
  return { ...rest, isBot: undefined, online: undefined } as LivePlayer
}

export type EnterRoomResult =
  | { kind: "joined"; roomId: number; tablesCount: number }
  | { kind: "queued"; position: number }
  | { kind: "disabled" }

export class RoomManager {
  constructor(private readonly queue: QueueManager) {}

  async getLobbyRows(): Promise<LobbyRoomRow[]> {
    const reg = await loadRoomRegistry()
    const rows: LobbyRoomRow[] = []
    for (const m of reg.rooms) {
      if (isRoomDisabledForJoin(m)) continue
      const info = await getTableInfo(m.roomId)
      const n = info?.livePlayers.length ?? 0
      rows.push({
        roomId: m.roomId,
        name: roomNameForDisplay(m.name, m.roomId),
        bottleSkin: normalizeRoomBottleSkin(m.bottleSkin ?? DEFAULT_ROOM_BOTTLE_SKIN),
        tableStyle: resolveEffectiveTableStyle(m),
        isUserRoom: m.isUserRoom === true,
        createdByUserId: m.createdByUserId,
        createdAtMs: m.createdAtMs,
        livePlayerCount: n,
        maxPlayers: ROOM_MAX_PLAYERS,
      })
    }
    const defaults = rows.filter((r) => !r.isUserRoom)
    const userCreated = rows
      .filter((r) => r.isUserRoom)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
    return [...defaults, ...userCreated]
  }

  async buildRoomState(roomId: number): Promise<RoomStatePayload> {
    const reg = await loadRoomRegistry()
    const meta = reg.rooms.find((r) => r.roomId === roomId)
    const name = roomNameForDisplay(meta?.name ?? "", roomId)
    const info = await getTableInfo(roomId)
    const live = info?.livePlayers ?? []
    await ensureTableAuthority(roomId)
    const gameState = await getTableAuthoritySnapshot(roomId)
    const bots = gameState?.players.filter((p) => p.isBot).length ?? Math.max(0, ROOM_MAX_PLAYERS - live.length)
    return {
      roomId,
      name,
      maxPlayers: ROOM_MAX_PLAYERS,
      livePlayers: live.map((p) => ({ ...p, isBot: false })),
      botCount: bots,
      gameState,
      chatId: `room:${roomId}`,
    }
  }

  /**
   * Вход в комнату: только в выбранную комнату.
   * При переполнении — очередь в эту же комнату, без редиректов на другие столы.
   */
  async tryEnterRoom(player: Player, requestedRoomId: number): Promise<EnterRoomResult> {
    const live = toLivePlayer({ ...player, isBot: false })
    const reg = await loadRoomRegistry()
    const requestedMeta = reg.rooms.find((r) => r.roomId === requestedRoomId)
    if (isRoomDisabledForJoin(requestedMeta)) {
      return { kind: "disabled" }
    }
    const ids = reg.rooms.filter((r) => !isRoomDisabledForJoin(r)).map((r) => r.roomId)
    if (!ids.includes(requestedRoomId)) {
      await this.tryEnqueue(live, requestedRoomId)
      return { kind: "queued", position: (await this.queue.position(live.id)) ?? 1 }
    }

    const first = await joinSpecificRoom({
      player: live,
      roomId: requestedRoomId,
      maxTableSize: ROOM_MAX_PLAYERS,
    })
    if (first.ok) {
      await ensureTableAuthority(requestedRoomId)
      return { kind: "joined", roomId: requestedRoomId, tablesCount: first.tablesCount }
    }

    await this.tryEnqueue(live, requestedRoomId)
    const pos = await this.queue.position(live.id)
    return { kind: "queued", position: pos ?? 1 }
  }

  private async tryEnqueue(live: LivePlayer, requestedRoomId: number): Promise<void> {
    await this.queue.remove(live.id)
    await this.queue.enqueue({
      userId: live.id,
      player: { ...live, isBot: false },
      requestedRoomId,
      enqueuedAt: Date.now(),
    })
  }

  async leaveRoom(userId: number): Promise<void> {
    await leaveLiveTable(userId)
    await this.queue.remove(userId)
  }

  /**
   * После освобождения места — взять следующего из очереди и посадить в первую доступную комнату.
   */
  async admitNextFromQueue(): Promise<{ player: Player; roomId: number } | null> {
    const next = await this.queue.dequeue()
    if (!next) return null
    const live = toLivePlayer(next.player)
    const reg = await loadRoomRegistry()
    const allowedIds = reg.rooms.filter((r) => !isRoomDisabledForJoin(r)).map((r) => r.roomId)
    const tryOrder = [
      next.requestedRoomId,
      ...allowedIds.filter((id) => id !== next.requestedRoomId),
    ]
    const seen = new Set<number>()
    for (const rid of tryOrder) {
      if (seen.has(rid)) continue
      seen.add(rid)
      const r = await joinSpecificRoom({
        player: live,
        roomId: rid,
        maxTableSize: ROOM_MAX_PLAYERS,
      })
      if (r.ok) {
        await ensureTableAuthority(rid)
        return { player: next.player, roomId: rid }
      }
    }
    await this.queue.enqueue(next)
    return null
  }
}
