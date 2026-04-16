import test from "node:test"
import assert from "node:assert/strict"
import { applyTableAuthorityAction } from "../lib/table-authority-apply"
import type { Player, TableAuthorityPayload } from "../lib/game-types"

function makePlayer(id: number, gender: "male" | "female"): Player {
  return {
    id,
    name: `Player ${id}`,
    avatar: `/avatars/${id}.png`,
    gender,
    age: 25,
    purpose: "communication",
    isBot: false,
  }
}

function makeSnapshot(): TableAuthorityPayload {
  const playerA = makePlayer(1, "male")
  const playerB = makePlayer(2, "female")
  const playerC = makePlayer(3, "female")

  return {
    revision: 1,
    players: [playerA, playerB, playerC],
    currentTurnIndex: 0,
    isSpinning: false,
    spinStartedAtMs: null,
    countdown: null,
    bottleAngle: 90,
    bottleSkin: "classic",
    tableStyle: "classic_night",
    targetPlayer: null,
    targetPlayer2: null,
    showResult: false,
    resultAction: null,
    roundNumber: 10,
    predictionPhase: true,
    predictions: [
      { playerId: 1, playerName: playerA.name, targetPair: [1, 2] },
      { playerId: 2, playerName: playerB.name, targetPair: [1, 3] },
    ],
    bets: [
      { playerId: 1, playerName: playerA.name, targetPair: [1, 2], amount: 10 },
      { playerId: 2, playerName: playerB.name, targetPair: [1, 3], amount: 20 },
    ],
    pot: 30,
    currentTurnDidSpin: false,
    extraTurnPlayerId: undefined,
    playerInUgadaika: null,
    spinSkips: { 1: 0, 2: 0, 3: 0 },
    gameLog: [],
    generalChatMessages: [],
    avatarFrames: {},
    drunkUntil: {},
    clientTabAway: {},
    pairKissPhase: null,
  }
}

test("START_PREDICTION_PHASE resets prediction artifacts for a fresh round window", () => {
  const snapshot = makeSnapshot()
  const result = applyTableAuthorityAction(snapshot, { type: "START_PREDICTION_PHASE" })

  assert.ok(result)
  assert.equal(result.predictionPhase, true)
  assert.deepEqual(result.predictions, [])
  assert.deepEqual(result.bets, [])
  assert.equal(result.pot, 0)
})

test("PLACE_BET replaces previous bet from the same player and recomputes the pot", () => {
  const snapshot = makeSnapshot()
  const result = applyTableAuthorityAction(snapshot, {
    type: "PLACE_BET",
    bet: {
      playerId: 1,
      playerName: "Player 1",
      targetPair: [2, 3],
      amount: 35,
    },
  })

  assert.ok(result)
  assert.equal(result.bets.length, 2)
  assert.deepEqual(
    result.bets.find((bet) => bet.playerId === 1),
    {
      playerId: 1,
      playerName: "Player 1",
      targetPair: [2, 3],
      amount: 35,
    },
  )
  assert.equal(result.pot, 55)
})

test("START_SPIN keeps synced predictions and bets until result settlement, but NEXT_TURN clears them", () => {
  const snapshot = makeSnapshot()
  const spinResult = applyTableAuthorityAction(snapshot, {
    type: "START_SPIN",
    angle: 810,
    target: snapshot.players[1],
    target2: snapshot.players[2],
  })

  assert.ok(spinResult)
  assert.equal(spinResult.predictionPhase, false)
  assert.equal(spinResult.predictions.length, 2)
  assert.equal(spinResult.bets.length, 2)
  assert.equal(spinResult.pot, 30)

  const nextTurn = applyTableAuthorityAction(spinResult, { type: "NEXT_TURN" })
  assert.ok(nextTurn)
  assert.equal(nextTurn.roundNumber, snapshot.roundNumber + 1)
  assert.equal(nextTurn.predictionPhase, false)
  assert.deepEqual(nextTurn.predictions, [])
  assert.deepEqual(nextTurn.bets, [])
  assert.equal(nextTurn.pot, 0)
})

test("RESET_ROUND clears leftover prediction artifacts to prevent stale bank state", () => {
  const snapshot = makeSnapshot()
  const result = applyTableAuthorityAction(snapshot, { type: "RESET_ROUND" })

  assert.ok(result)
  assert.equal(result.predictionPhase, false)
  assert.deepEqual(result.predictions, [])
  assert.deepEqual(result.bets, [])
  assert.equal(result.pot, 0)
})
