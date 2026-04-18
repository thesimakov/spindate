import test from "node:test"
import assert from "node:assert/strict"
import { TABLE_SYNCED_ACTION_TYPES } from "../lib/sync-invariants"

test("sync whitelist includes required multiplayer lifecycle actions", () => {
  const set = new Set(TABLE_SYNCED_ACTION_TYPES)
  assert.equal(set.has("START_COUNTDOWN"), true)
  assert.equal(set.has("START_SPIN"), true)
  assert.equal(set.has("STOP_SPIN"), true)
  assert.equal(set.has("NEXT_TURN"), true)
  assert.equal(set.has("SEND_GENERAL_CHAT"), true)
  assert.equal(set.has("SET_BOTTLE_TABLE_PURCHASE"), true)
})

test("sync whitelist excludes local economy-only actions", () => {
  const set = new Set(TABLE_SYNCED_ACTION_TYPES)
  assert.equal(set.has("PAY_VOICES"), false)
  assert.equal(set.has("ADD_VOICES"), false)
  assert.equal(set.has("ADD_BONUS"), false)
})

test("sync whitelist has no duplicates", () => {
  const arr = [...TABLE_SYNCED_ACTION_TYPES]
  const set = new Set(arr)
  assert.equal(set.size, arr.length)
})
