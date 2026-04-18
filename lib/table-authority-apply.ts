import type { GameAction, Player, TableAuthorityPayload } from "@/lib/game-types"
import { GAME_TABLE_LOG_MAX_ENTRIES } from "@/lib/game-types"
import { trimRoomChatMessages } from "@/lib/room-chat-retention"

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
  const predictions = snapshot.predictions ?? []
  const bets = snapshot.bets ?? []
  const pot = snapshot.pot ?? 0
  switch (action.type) {
    case "REQUEST_EXTRA_TURN":
      return { ...snapshot, extraTurnPlayerId: action.playerId }
    case "ADD_LOG":
      return {
        ...snapshot,
        gameLog: [...snapshot.gameLog.slice(-GAME_TABLE_LOG_MAX_ENTRIES), action.entry].slice(
          -GAME_TABLE_LOG_MAX_ENTRIES,
        ),
      }
    case "SEND_GENERAL_CHAT": {
      const list = [...(snapshot.generalChatMessages ?? []), action.message]
      return { ...snapshot, generalChatMessages: trimRoomChatMessages(list) }
    }
    case "START_COUNTDOWN":
      if (snapshot.isSpinning || snapshot.showResult || snapshot.pairKissPhase != null) {
        return null
      }
      return { ...snapshot, countdown: 3, spinStartedAtMs: null }
    case "TICK_COUNTDOWN":
      if (snapshot.countdown == null || snapshot.isSpinning || snapshot.showResult || snapshot.pairKissPhase != null) {
        return null
      }
      return {
        ...snapshot,
        countdown: snapshot.countdown !== null && snapshot.countdown > 1 ? snapshot.countdown - 1 : null,
      }
    case "START_SPIN": {
      if (snapshot.isSpinning || snapshot.showResult || snapshot.pairKissPhase != null) {
        return null
      }
      const t1 = playerById(snapshot.players, action.target.id) ?? action.target
      const t2 = playerById(snapshot.players, action.target2.id) ?? action.target2
      const spinnerId = snapshot.players[snapshot.currentTurnIndex]?.id
      const nextSpinSkips = { ...snapshot.spinSkips }
      if (spinnerId != null) nextSpinSkips[spinnerId] = 0
      return {
        ...snapshot,
        isSpinning: true,
        spinStartedAtMs: Date.now(),
        countdown: null,
        bottleAngle: action.angle,
        targetPlayer: t1,
        targetPlayer2: t2,
        predictionPhase: false,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: true,
        pairKissPhase: null,
      }
    }
    case "STOP_SPIN":
      if (!snapshot.isSpinning) {
        return null
      }
      return { ...snapshot, isSpinning: false, spinStartedAtMs: null, showResult: true, resultAction: action.action }
    case "BEGIN_PAIR_KISS_PHASE": {
      const tp = snapshot.targetPlayer
      const tp2 = snapshot.targetPlayer2
      if (!snapshot.showResult || !tp || !tp2) return null
      if (action.idB !== tp.id || action.idA !== tp2.id) return null
      return {
        ...snapshot,
        pairKissPhase: {
          roundKey: action.roundKey,
          deadlineMs: action.deadlineMs,
          idA: action.idA,
          idB: action.idB,
          choiceA: null,
          choiceB: null,
          resolved: false,
          outcome: null,
        },
      }
    }
    case "SET_PAIR_KISS_CHOICE": {
      const ph = snapshot.pairKissPhase
      if (!ph || ph.resolved) return null
      if (action.playerId !== ph.idA && action.playerId !== ph.idB) return null
      if (action.playerId === ph.idA && ph.choiceA !== null) return null
      if (action.playerId === ph.idB && ph.choiceB !== null) return null
      const choiceA = action.playerId === ph.idA ? action.yes : ph.choiceA
      const choiceB = action.playerId === ph.idB ? action.yes : ph.choiceB
      return {
        ...snapshot,
        pairKissPhase: {
          ...ph,
          choiceA,
          choiceB,
        },
      }
    }
    case "FINALIZE_PAIR_KISS": {
      const ph = snapshot.pairKissPhase
      if (!ph || ph.resolved) return null
      const ca = ph.choiceA ?? false
      const cb = ph.choiceB ?? false
      let outcome: "both_yes" | "only_a" | "only_b" | "both_no"
      if (ca && cb) outcome = "both_yes"
      else if (ca && !cb) outcome = "only_a"
      else if (!ca && cb) outcome = "only_b"
      else outcome = "both_no"
      return {
        ...snapshot,
        pairKissPhase: {
          ...ph,
          choiceA: ca,
          choiceB: cb,
          resolved: true,
          outcome,
        },
      }
    }
    case "NEXT_TURN": {
      const now = Date.now()
      if (snapshot.players.length === 0) {
        return {
          ...snapshot,
          currentTurnIndex: 0,
          turnStartedAtMs: now,
          showResult: false,
          targetPlayer: null,
          targetPlayer2: null,
          resultAction: null,
          predictionPhase: false,
          predictions: [],
          bets: [],
          pot: 0,
          extraTurnPlayerId: undefined,
          pairKissPhase: null,
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
        turnStartedAtMs: now,
        showResult: false,
        isSpinning: false,
        spinStartedAtMs: null,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        bottleAngle: normAngle,
        predictionPhase: false,
        predictions: [],
        bets: [],
        pot: 0,
        roundNumber: snapshot.roundNumber + 1,
        extraTurnPlayerId: undefined,
        pairKissPhase: null,
      }
    }
    case "START_PREDICTION_PHASE":
      return {
        ...snapshot,
        predictionPhase: true,
        predictions: [],
        bets: [],
        pot: 0,
      }
    case "END_PREDICTION_PHASE":
      return { ...snapshot, predictionPhase: false }
    case "ADD_PREDICTION": {
      const filtered = predictions.filter((prediction) => prediction.playerId !== action.prediction.playerId)
      return { ...snapshot, predictions: [...filtered, action.prediction] }
    }
    case "CLEAR_PREDICTIONS":
      return { ...snapshot, predictions: [] }
    case "PLACE_BET": {
      const filtered = bets.filter((bet) => bet.playerId !== action.bet.playerId)
      const nextBets = [...filtered, action.bet]
      return {
        ...snapshot,
        bets: nextBets,
        pot: nextBets.reduce((sum, bet) => sum + bet.amount, 0),
      }
    }
    case "CLEAR_BETS":
      return { ...snapshot, bets: [], pot: 0 }
    case "ADD_TO_POT":
      return { ...snapshot, pot: pot + action.amount }
    case "RESET_POT":
      return { ...snapshot, pot: 0 }
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
    case "SET_BOTTLE_TABLE_PURCHASE":
      return {
        ...snapshot,
        bottleSkin: action.skin,
        bottleCooldownUntil: action.cooldownUntil,
        bottleDonorId: action.donorId,
        bottleDonorName: action.donorName,
      }
    case "SET_BOTTLE_DONOR":
      return {
        ...snapshot,
        bottleDonorId: action.playerId,
        bottleDonorName: action.playerName,
      }
    case "RESET_ROUND":
      return {
        ...snapshot,
        turnStartedAtMs: Date.now(),
        showResult: false,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        isSpinning: false,
        predictionPhase: false,
        predictions: [],
        bets: [],
        pot: 0,
        spinStartedAtMs: null,
        pairKissPhase: null,
      }
    case "SET_BOTTLE_COOLDOWN_UNTIL":
      return { ...snapshot, bottleCooldownUntil: action.ts }
    case "SET_CLIENT_TAB_AWAY": {
      const next = { ...(snapshot.clientTabAway ?? {}) }
      if (action.away) {
        next[action.playerId] = true
      } else {
        delete next[action.playerId]
      }
      return { ...snapshot, clientTabAway: next }
    }
    default:
      return null
  }
}
