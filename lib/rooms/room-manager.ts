import type { LivePlayer } from "@/lib/live-tables-core"
import type { Player } from "@/lib/game-types"
import { joinSpecificRoom, leaveLiveTable, getTableInfo } from "@/lib/live-tables-server"
import { ensureTableAuthority, getTableAuthoritySnapshot } from "@/lib/table-authority-server"
import { createPublicRoom, isRoomDisabledForJoin, loadRoomRegistry } from "@/lib/rooms/room-registry"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import type { LobbyRoomRow, RoomMeta, RoomStatePayload } from "@/lib/rooms/types"
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

  private async tryJoinRoomId(live: LivePlayer, roomId: number): Promise<{ ok: boolean; tablesCount: number }> {
    const joined = await joinSpecificRoom({
      player: live,
      roomId,
      maxTableSize: ROOM_MAX_PLAYERS,
    })
    if (!joined.ok) return { ok: false, tablesCount: 0 }
    await ensureTableAuthority(roomId)
    return { ok: true, tablesCount: joined.tablesCount }
  }

  private async resolvePublicRoomJoinTarget(requestedRoomId: number, reg: { rooms: RoomMeta[] }): Promise<number> {
    const candidates = reg.rooms.filter((r) => !r.isUserRoom && !isRoomDisabledForJoin(r))
    const scored: Array<{ roomId: number; liveCount: number }> = []
    for (const room of candidates) {
      const info = await getTableInfo(room.roomId)
      const liveCount = info?.livePlayers.length ?? 0
      if (liveCount < ROOM_MAX_PLAYERS) {
        scored.push({ roomId: room.roomId, liveCount })
      }
    }
    if (scored.length > 0) {
      scored.sort((a, b) => {
        if (a.roomId === requestedRoomId) return -1
        if (b.roomId === requestedRoomId) return 1
        if (b.liveCount !== a.liveCount) return b.liveCount - a.liveCount
        return a.roomId - b.roomId
      })
      return scored[0]!.roomId
    }
    const created = await createPublicRoom()
    return created.roomId
  }

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
      return { kind: "queued", position: (await this.queue.position(live.id, requestedRoomId)) ?? 1 }
    }

    if (requestedMeta?.isUserRoom === true) {
      const first = await this.tryJoinRoomId(live, requestedRoomId)
      if (first.ok) {
        await this.queue.remove(live.id)
        return { kind: "joined", roomId: requestedRoomId, tablesCount: first.tablesCount }
      }
      await this.tryEnqueue(live, requestedRoomId)
      const pos = await this.queue.position(live.id, requestedRoomId)
      return { kind: "queued", position: pos ?? 1 }
    }

    const targetRoomId = await this.resolvePublicRoomJoinTarget(requestedRoomId, reg)
    const joined = await this.tryJoinRoomId(live, targetRoomId)
    if (joined.ok) {
      await this.queue.remove(live.id)
      return { kind: "joined", roomId: targetRoomId, tablesCount: joined.tablesCount }
    }
    const fallbackCreated = await createPublicRoom()
    const fallback = await this.tryJoinRoomId(live, fallbackCreated.roomId)
    if (fallback.ok) {
      await this.queue.remove(live.id)
      return { kind: "joined", roomId: fallbackCreated.roomId, tablesCount: fallback.tablesCount }
    }
    await this.tryEnqueue(live, requestedRoomId)
    const pos = await this.queue.position(live.id, requestedRoomId)
    return { kind: "queued", position: pos ?? 1 }
  }

  private async tryEnqueue(live: LivePlayer, requestedRoomId: number): Promise<void> {
    const existing = await this.queue.getEntry(live.id)
    if (existing?.requestedRoomId === requestedRoomId) return
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
   * После освобождения места — взять следующего ожидающего именно для этого стола.
   */
  async admitNextFromQueue(requestedRoomId: number): Promise<{ player: Player; roomId: number } | null> {
    const next = await this.queue.dequeueForRoom(requestedRoomId)
    if (!next) return null
    const live = toLivePlayer(next.player)
    const joined = await this.tryJoinRoomId(live, next.requestedRoomId)
    if (joined.ok) {
      return { player: next.player, roomId: next.requestedRoomId }
    }
    await this.tryEnqueue(live, next.requestedRoomId)
    return null
  }
}
