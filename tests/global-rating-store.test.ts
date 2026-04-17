import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import type { Player } from "../lib/game-types"

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spindate-rating-"))
process.env.SPINDATE_DATA_DIR = TEST_DATA_DIR

function makePlayer(id: number, name: string): Player {
  return {
    id,
    name,
    avatar: `/avatars/${id}.png`,
    gender: id % 2 === 0 ? "female" : "male",
    age: 25,
    purpose: "communication",
    authProvider: "vk",
    vkUserId: 5_000 + id,
    isBot: false,
  }
}

test("queryGlobalLeaderboard returns score and latest actor meta in one pass", async () => {
  const { tryInsertGlobalRatingFromAddLog, queryGlobalLeaderboard } = await import("../lib/global-rating-store")

  const now = Date.now()
  const playerA = makePlayer(1, "Алиса")
  const playerB = makePlayer(2, "Боб")

  tryInsertGlobalRatingFromAddLog({
    tableId: 1,
    createdAtMs: now - 3_000,
    action: {
      type: "ADD_LOG",
      entry: {
        id: "log-a-1",
        type: "kiss",
        fromPlayer: playerA,
        text: "A",
        timestamp: now - 3_000,
      },
    },
  })
  tryInsertGlobalRatingFromAddLog({
    tableId: 1,
    createdAtMs: now - 2_000,
    action: {
      type: "ADD_LOG",
      entry: {
        id: "log-a-2",
        type: "kiss",
        fromPlayer: { ...playerA, name: "Алиса v2", avatar: "/avatars/new-a.png" },
        text: "A2",
        timestamp: now - 2_000,
      },
    },
  })
  tryInsertGlobalRatingFromAddLog({
    tableId: 1,
    createdAtMs: now - 1_000,
    action: {
      type: "ADD_LOG",
      entry: {
        id: "log-b-1",
        type: "kiss",
        fromPlayer: playerB,
        text: "B",
        timestamp: now - 1_000,
      },
    },
  })

  const rows = queryGlobalLeaderboard({
    category: "love",
    startMs: now - 10_000,
    endMs: now + 1_000,
    limit: 10,
  })

  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.name, "Алиса v2")
  assert.equal(rows[0]?.score, 2)
  assert.equal(rows[0]?.avatar, "/avatars/new-a.png")
  assert.equal(rows[1]?.name, "Боб")
  assert.equal(rows[1]?.score, 1)
})
