import test from "node:test"
import assert from "node:assert/strict"
import { mergeLivePlayersIntoAuthority } from "../lib/table-authority-merge"
import type { Player, TableAuthorityPayload } from "../lib/game-types"

function makeHuman(id: number): Player {
  return {
    id,
    name: `Human ${id}`,
    avatar: `/a/${id}.png`,
    gender: "male",
    age: 20,
    purpose: "communication",
    isBot: false,
  }
}

function makeBot(id: number): Player {
  return {
    id,
    name: `Bot ${id}`,
    avatar: "",
    gender: "female",
    age: 22,
    purpose: "communication",
    isBot: true,
  }
}

function minimalSnapshot(players: Player[], currentTurnIndex: number): TableAuthorityPayload {
  const ids = players.map((p) => p.id)
  const spinSkips: Record<number, number> = {}
  for (const id of ids) spinSkips[id] = 0
  return {
    revision: 2,
    players,
    currentTurnIndex,
    turnStartedAtMs: Date.now() - 1000,
    isSpinning: false,
    spinStartedAtMs: null,
    countdown: null,
    bottleAngle: 0,
    bottleSkin: "classic",
    tableStyle: "classic_night",
    targetPlayer: null,
    targetPlayer2: null,
    showResult: false,
    resultAction: null,
    roundNumber: 5,
    predictionPhase: false,
    predictions: [],
    bets: [],
    pot: 0,
    currentTurnDidSpin: false,
    extraTurnPlayerId: undefined,
    playerInUgadaika: null,
    spinSkips,
    gameLog: [],
    generalChatMessages: [],
    avatarFrames: {},
    drunkUntil: {},
    clientTabAway: {},
    pairKissPhase: null,
  }
}

test("после смены пула ботов ход остаётся у бота (не прыгает на первого живого)", () => {
  const human = makeHuman(1)
  const oldBot = makeBot(900)
  const snapshot = minimalSnapshot([human, oldBot], 1)

  const newBot = makeBot(901)
  const incoming = [human, newBot]
  const out = mergeLivePlayersIntoAuthority(snapshot, incoming, human)

  assert.equal(out.players.length, 2)
  assert.equal(out.players[0]!.id, 1)
  assert.equal(out.players[1]!.id, 901)
  assert.equal(out.currentTurnIndex, 1)
  assert.equal(out.players[out.currentTurnIndex]?.id, 901)
  assert.equal(out.players[out.currentTurnIndex]?.isBot, true)
})

test("если текущий бот пропал и в составе нет ботов — ход на индекс 0", () => {
  const human = makeHuman(1)
  const oldBot = makeBot(900)
  const snapshot = minimalSnapshot([human, oldBot], 1)

  const incoming = [human]
  const out = mergeLivePlayersIntoAuthority(snapshot, incoming, human)

  assert.equal(out.players.length, 1)
  assert.equal(out.currentTurnIndex, 0)
  assert.equal(out.players[0]!.id, 1)
})

test("пропавший живой ход — по-прежнему индекс 0", () => {
  const a = makeHuman(1)
  const b = makeHuman(2)
  const snapshot = minimalSnapshot([a, b], 1)

  const incoming = [a]
  const out = mergeLivePlayersIntoAuthority(snapshot, incoming, a)

  assert.equal(out.currentTurnIndex, 0)
  assert.equal(out.players[out.currentTurnIndex]?.id, 1)
})
