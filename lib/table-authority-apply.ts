import type { GameAction, Player, TableAuthorityPayload } from "@/lib/game-types"

function playerById(players: Player[], id: number): Player | undefined {
  return players.find((p) => p.id === id)
}

/**
 * Применить игровое событие к авторитетному снапшоту (та же логика, что в gameReducer для этих типов).
 */
export function applyTableAuthorityAction(
  snapshot: TableAuthorityPayload,
  action: GameAction,
): TableAuthorityPayload | null {
  switch (action.type) {
    case "REQUEST_EXTRA_TURN":
      return { ...snapshot, extraTurnPlayerId: action.playerId }
    case "ADD_LOG":
      return {
        ...snapshot,
        gameLog: [...snapshot.gameLog.slice(-50), action.entry].slice(-50),
      }
    case "SEND_GENERAL_CHAT": {
      const list = [...(snapshot.generalChatMessages ?? []), action.message]
      return { ...snapshot, generalChatMessages: list.slice(-50) }
    }
    case "START_COUNTDOWN":
      return { ...snapshot, countdown: 3 }
    case "TICK_COUNTDOWN":
      return {
        ...snapshot,
        countdown: snapshot.countdown !== null && snapshot.countdown > 1 ? snapshot.countdown - 1 : null,
      }
    case "START_SPIN": {
      const t1 = playerById(snapshot.players, action.target.id) ?? action.target
      const t2 = playerById(snapshot.players, action.target2.id) ?? action.target2
      const spinnerId = snapshot.players[snapshot.currentTurnIndex]?.id
      const nextSpinSkips = { ...snapshot.spinSkips }
      if (spinnerId != null) nextSpinSkips[spinnerId] = 0
      return {
        ...snapshot,
        isSpinning: true,
        countdown: null,
        bottleAngle: action.angle,
        targetPlayer: t1,
        targetPlayer2: t2,
        predictionPhase: false,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: true,
      }
    }
    case "STOP_SPIN":
      return { ...snapshot, isSpinning: false, showResult: true, resultAction: action.action }
    case "NEXT_TURN": {
      if (snapshot.players.length === 0) {
        return {
          ...snapshot,
          currentTurnIndex: 0,
          showResult: false,
          targetPlayer: null,
          targetPlayer2: null,
          resultAction: null,
          predictionPhase: false,
          extraTurnPlayerId: undefined,
        }
      }

      let nextIndex = (snapshot.currentTurnIndex + 1) % snapshot.players.length

      if (snapshot.extraTurnPlayerId != null) {
        const idx = snapshot.players.findIndex((p) => p.id === snapshot.extraTurnPlayerId)
        if (idx !== -1) nextIndex = idx
      }

      const inUgadaika = snapshot.playerInUgadaika ?? null
      if (inUgadaika != null && snapshot.players.length > 0) {
        let steps = 0
        while (snapshot.players[nextIndex]?.id === inUgadaika && steps < snapshot.players.length) {
          nextIndex = (nextIndex + 1) % snapshot.players.length
          steps++
        }
      }

      const nextSpinSkips = { ...snapshot.spinSkips }
      const playerWhoHadTurnId = snapshot.players[snapshot.currentTurnIndex]?.id
      if (!snapshot.currentTurnDidSpin && playerWhoHadTurnId != null) {
        nextSpinSkips[playerWhoHadTurnId] = (snapshot.spinSkips?.[playerWhoHadTurnId] ?? 0) + 1
      }

      const normAngle = snapshot.bottleAngle % 360
      return {
        ...snapshot,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: false,
        currentTurnIndex: nextIndex,
        showResult: false,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        bottleAngle: normAngle,
        predictionPhase: false,
        roundNumber: snapshot.roundNumber + 1,
        extraTurnPlayerId: undefined,
      }
    }
    case "SET_AVATAR_FRAME": {
      const frames = { ...(snapshot.avatarFrames ?? {}) }
      if (action.frameId === "none") {
        delete frames[action.playerId]
      } else {
        frames[action.playerId] = action.frameId
      }
      return { ...snapshot, avatarFrames: frames }
    }
    case "ADD_DRUNK_TIME": {
      const now = Date.now()
      const current = (snapshot.drunkUntil ?? {})[action.playerId] ?? 0
      const base = Math.max(now, current)
      return {
        ...snapshot,
        drunkUntil: {
          ...(snapshot.drunkUntil ?? {}),
          [action.playerId]: base + action.ms,
        },
      }
    }
    case "SET_BOTTLE_SKIN":
      return { ...snapshot, bottleSkin: action.skin }
    case "SET_BOTTLE_DONOR":
      return {
        ...snapshot,
        bottleDonorId: action.playerId,
        bottleDonorName: action.playerName,
      }
    default:
      return null
  }
}
