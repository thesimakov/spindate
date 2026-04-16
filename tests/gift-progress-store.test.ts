import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import type { Player } from "../lib/game-types"

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "spindate-gift-progress-"))
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
    vkUserId: 1000 + id,
    isBot: false,
  }
}

test("recordGiftProgressEvent stores gift stats separately and does not double-count dedupe ids", async () => {
  const { recordGiftProgressEvent, queryGiftProgressStatsForPlayer } = await import("../lib/gift-progress-store")
  const fromPlayer = makePlayer(1, "Даритель")
  const toPlayer = makePlayer(2, "Получатель")

  const first = recordGiftProgressEvent({
    dedupeId: "gift-progress-1",
    fromPlayer,
    toPlayer,
    giftId: "toy_bear",
    heartsCost: 15,
  })

  assert.equal(first.achievementUnlockedNow, true)
  assert.equal(first.stats.giftsSentCount, 1)
  assert.equal(first.stats.heartsSpent, 15)
  assert.equal(first.stats.achievement.unlocked, true)

  const duplicate = recordGiftProgressEvent({
    dedupeId: "gift-progress-1",
    fromPlayer,
    toPlayer,
    giftId: "toy_bear",
    heartsCost: 15,
  })

  assert.equal(duplicate.achievementUnlockedNow, false)
  assert.equal(duplicate.stats.giftsSentCount, 1)
  assert.equal(duplicate.stats.heartsSpent, 15)

  const next = recordGiftProgressEvent({
    dedupeId: "gift-progress-2",
    fromPlayer,
    toPlayer,
    giftId: "plush_heart",
    rosesCost: 5,
  })

  assert.equal(next.achievementUnlockedNow, false)
  assert.equal(next.stats.giftsSentCount, 2)
  assert.equal(next.stats.heartsSpent, 15)
  assert.equal(next.stats.rosesSpent, 5)

  const fromStats = queryGiftProgressStatsForPlayer(fromPlayer)
  assert.equal(fromStats.giftsSentCount, 2)
  assert.equal(fromStats.heartsSpent, 15)
  assert.equal(fromStats.rosesSpent, 5)
})
