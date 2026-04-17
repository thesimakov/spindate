import test from "node:test"
import assert from "node:assert/strict"
import {
  BOTTLE_SPIN_ANIMATION_MS,
  BOTTLE_STUCK_KICK_AFTER_MS,
  SPIN_HANG_FAILSAFE_MS,
  SPIN_RESOLVE_AFTER_MS,
  SPIN_RESOLVE_GRACE_MS,
  SERVER_SPIN_STUCK_MS,
} from "../lib/spin-timing"

test("spin timing constants stay internally consistent", () => {
  assert.equal(BOTTLE_SPIN_ANIMATION_MS, 6_000)
  assert.equal(BOTTLE_STUCK_KICK_AFTER_MS, 2_000)
  assert.equal(SPIN_RESOLVE_AFTER_MS, BOTTLE_SPIN_ANIMATION_MS + 500)
  assert.ok(SPIN_RESOLVE_GRACE_MS >= 2_000)
  assert.ok(SPIN_HANG_FAILSAFE_MS > SPIN_RESOLVE_AFTER_MS + SPIN_RESOLVE_GRACE_MS)
  assert.ok(SERVER_SPIN_STUCK_MS > BOTTLE_SPIN_ANIMATION_MS)
})
