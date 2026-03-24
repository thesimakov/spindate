import type { TableAuthorityPayload } from "@/lib/game-types"
import type { Player } from "@/lib/game-types"
import { generateLogId } from "@/lib/ids"
import { getPairGenderCombo } from "@/lib/pair-utils"
/**
 * Начальное состояние стола (аналог SET_TABLE в gameReducer), без currentUser-зависимых текстов.
 */
export function buildInitialAuthoritySnapshot(players: Player[], tableId: number): TableAuthorityPayload {
  const now = Date.now()
  const nextPlayers = players
  const spinnerIdx = nextPlayers.length > 0 ? Math.floor(Math.random() * nextPlayers.length) : 0
  const spinner = nextPlayers[spinnerIdx]
  const others = spinner ? nextPlayers.filter((p) => p.id !== spinner.id) : []

  const target1 = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : null
  const target2 =
    others.length > 1
      ? (() => {
          const pool = others.filter((p) => p.id !== target1?.id)
          return pool[Math.floor(Math.random() * pool.length)]
        })()
      : null

  let bottleAngle = Math.floor(Math.random() * 360)
  let showResult = false
  let resultAction: string | null = null
  let targetPlayer: Player | null = null
  let targetPlayer2: Player | null = null
  let gameLog = [] as TableAuthorityPayload["gameLog"]

  if (spinner && target1 && target2 && nextPlayers.length >= 3) {
    const targetIdx = nextPlayers.findIndex((p) => p.id === target1.id)
    const segmentDeg = 360 / nextPlayers.length
    const targetDeg = -90 + segmentDeg * targetIdx
    bottleAngle = ((targetDeg + 90) % 360 + 360) % 360

    targetPlayer = target1
    targetPlayer2 = target2
    showResult = true

    const combo = getPairGenderCombo(target1, target2)
    if (combo === "MF") resultAction = "kiss"
    else if (combo === "MM") resultAction = "beer"
    else resultAction = "cocktail"

    const pairText = `${target1.name} & ${target2.name}`
    gameLog = [
      {
        id: generateLogId(),
        type: "system",
        fromPlayer: spinner,
        text: `Вы присоединились к столу #${tableId}. Игра уже идёт`,
        timestamp: now,
      },
      {
        id: generateLogId(),
        type: "system",
        fromPlayer: spinner,
        toPlayer: target1,
        text: `Выпала пара: ${pairText}`,
        timestamp: now,
      },
    ]
  } else {
    gameLog = [
      {
        id: generateLogId(),
        type: "system",
        text: `Вы присоединились к столу #${tableId}. Игра уже идёт`,
        timestamp: now,
      },
    ]
  }

  const spinSkips: Record<number, number> = {}
  nextPlayers.forEach((p) => {
    spinSkips[p.id] = 0
  })

  const snapshot: TableAuthorityPayload = {
    revision: 0,
    players: nextPlayers,
    currentTurnIndex: spinnerIdx,
    spinSkips,
    currentTurnDidSpin: false,
    isSpinning: false,
    countdown: null,
    bottleAngle,
    targetPlayer,
    targetPlayer2,
    showResult,
    resultAction,
    roundNumber: 5 + Math.floor(Math.random() * 25),
    predictionPhase: false,
    playerInUgadaika: null,
    generalChatMessages: [],
    gameLog: gameLog.slice(-50),
    avatarFrames: {},
    drunkUntil: {},
  }
  return snapshot
}
